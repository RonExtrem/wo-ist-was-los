// Schreibt Roh-Events in die Datenbank: Ort ergänzen, Doppelte zusammenführen, Terminänderungen erkennen.
import type { RohEvent } from "./typen.ts";
import { db } from "./lib/db.ts";
import { ortSuchen, abstandKm, KLAGENFURT, SAMMEL_RADIUS_KM } from "./lib/geo.ts";
import { fingerabdruck, titelAehnlichkeit } from "./lib/doppelte.ts";
import { wienTag } from "./lib/zeit.ts";

export interface SpeicherStatistik {
  neu: number;
  aktualisiert: number;
  zusammengefuehrt: number;
  terminGeaendert: number;
  ohneOrt: number;
  zuWeitWeg: number;
  vergangen: number;
}

export function leereStatistik(): SpeicherStatistik {
  return { neu: 0, aktualisiert: 0, zusammengefuehrt: 0, terminGeaendert: 0, ohneOrt: 0, zuWeitWeg: 0, vergangen: 0 };
}

async function ortErmitteln(e: RohEvent): Promise<{ lat: number; lng: number; region: string | null } | null> {
  if (e.lat != null && e.lng != null) return { lat: e.lat, lng: e.lng, region: e.region ?? null };
  const landName = { AT: "Österreich", SI: "Slowenien", IT: "Italien" }[e.land];
  // Erst genau (Adresse), dann Ortsname, zuletzt nur der Ort (letzter Teil, z. B. „Stadtpfarrkirche, Hermagor“ → „Hermagor“)
  const nurOrt = e.ortName.split(",").pop()?.trim();
  const adresseOhneStrasse = e.adresse?.split(",").slice(-2).join(",").trim();
  const versuche = [e.adresse, `${e.ortName}, ${landName}`, adresseOhneStrasse, nurOrt ? `${nurOrt}, ${landName}` : undefined]
    .filter((v, i, arr): v is string => !!v && arr.indexOf(v) === i);
  for (const anfrage of versuche) {
    const ort = await ortSuchen(anfrage);
    if (ort) return { lat: ort.lat, lng: ort.lng, region: e.region ?? ort.region };
  }
  return null;
}

export async function speichereEvents(
  events: RohEvent[],
  statistik: SpeicherStatistik,
  log: (t: string) => void
): Promise<void> {
  const pool = db();
  const jetzt = Date.now();

  // Wie oft kommt jede URL in diesem Lauf vor? (Nur Einzel-Termine eignen sich für die Terminänderungs-Erkennung)
  const urlAnzahl = new Map<string, number>();
  for (const e of events) urlAnzahl.set(e.url, (urlAnzahl.get(e.url) ?? 0) + 1);

  for (const e of events) {
    const endeOderBeginn = (e.ende ?? e.beginn).getTime();
    if (endeOderBeginn < jetzt - 6 * 3600_000) {
      statistik.vergangen++;
      continue;
    }

    const ort = await ortErmitteln(e);
    if (!ort) {
      statistik.ohneOrt++;
      log(`  ohne Ort verworfen: ${e.titel} (${e.ortName})`);
      continue;
    }
    if (abstandKm(ort, KLAGENFURT) > SAMMEL_RADIUS_KM) {
      statistik.zuWeitWeg++;
      continue;
    }

    const tag = wienTag(e.beginn);
    const fp = fingerabdruck(e.titel, tag, ort.lat, ort.lng);
    const punkt = `SRID=4326;POINT(${ort.lng} ${ort.lat})`;

    // 1) Gleiches Event schon da (Fingerabdruck oder gleiche URL am gleichen Tag)?
    // (gleiche URL zählt nur bei echten Detailseiten – auf Übersichtsseiten stehen viele Events mit derselben URL)
    let { rows } = await pool.query(
      `SELECT e.id FROM events e WHERE e.fingerabdruck = $1
       UNION
       SELECT e.id FROM events e JOIN event_links l ON l.event_id = e.id
        WHERE $4 AND l.url = $2 AND (e.beginn AT TIME ZONE 'Europe/Vienna')::date = $3::date
       LIMIT 1`,
      [fp, e.url, tag, e.urlIstDetail === true]
    );
    let eventId: string | null = rows[0]?.id ?? null;
    let art: "aktualisiert" | "zusammengefuehrt" | "neu" | "termin" = "aktualisiert";

    // 2) Terminänderung: URL kennt genau ein künftiges Event mit anderem Datum
    if (!eventId && e.urlIstDetail === true && urlAnzahl.get(e.url) === 1) {
      ({ rows } = await pool.query(
        `SELECT e.id, e.beginn, e.ende FROM events e JOIN event_links l ON l.event_id = e.id
          WHERE l.url = $1 AND l.quelle_id = $2 AND e.beginn > now() AND e.status <> 'verschwunden'`,
        [e.url, e.quelleId]
      ));
      if (rows.length === 1) {
        eventId = rows[0].id;
        art = "termin";
        await pool.query(
          `INSERT INTO event_aenderungen (event_id, art, alt, neu) VALUES ($1, 'termin', $2, $3)`,
          [eventId, JSON.stringify({ beginn: rows[0].beginn, ende: rows[0].ende }), JSON.stringify({ beginn: e.beginn, ende: e.ende ?? null })]
        );
      }
    }

    // 3) Dasselbe Event aus einer anderen Quelle? (±1 Tag, < 2 km, ähnlicher Titel)
    if (!eventId) {
      ({ rows } = await pool.query(
        `SELECT id, titel FROM events
          WHERE beginn BETWEEN $1::timestamptz - interval '1 day' AND $1::timestamptz + interval '1 day'
            AND ST_DWithin(geo, $2::geography, 2000)`,
        [e.beginn, punkt]
      ));
      const treffer = rows
        .map((r) => ({ id: r.id as string, wert: titelAehnlichkeit(r.titel, e.titel) }))
        .filter((r) => r.wert >= 0.5)
        .sort((a, b) => b.wert - a.wert)[0];
      if (treffer) {
        eventId = treffer.id;
        art = "zusammengefuehrt";
      }
    }

    if (eventId) {
      // Vorhandenes Event auffrischen. Bei Zusammenführung nur Lücken füllen, nicht überschreiben.
      if (art === "zusammengefuehrt") {
        await pool.query(
          `UPDATE events SET zuletzt_gesehen = now(),
             kurzbeschreibung = coalesce(kurzbeschreibung, $2),
             preis_text = coalesce(preis_text, $3),
             bild_url = coalesce(bild_url, $4),
             kategorien = ARRAY(SELECT DISTINCT unnest(kategorien || $5::text[])),
             status = CASE WHEN status = 'verschwunden' THEN 'aktiv' ELSE status END
           WHERE id = $1`,
          [eventId, e.beschreibung ?? null, e.preisText ?? null, e.bildUrl ?? null, e.kategorien]
        );
        statistik.zusammengefuehrt++;
      } else {
        await pool.query(
          `UPDATE events SET titel = $2, kurzbeschreibung = coalesce($3, kurzbeschreibung), beginn = $4, ende = $5,
             ganztaegig = $6, ort_name = $7, adresse = $8, geo = $9::geography, region = coalesce($10, region),
             kategorien = $11, preis_text = $12, gratis = $13, bild_url = coalesce($14, bild_url),
             freiluft = $15, sicherheit = $16, aktualisiert = now(), zuletzt_gesehen = now(),
             status = CASE WHEN $17 THEN 'geaendert' WHEN status = 'verschwunden' THEN 'aktiv' ELSE status END,
             fingerabdruck = CASE WHEN $17 THEN $18 ELSE fingerabdruck END
           WHERE id = $1`,
          [
            eventId, e.titel, e.beschreibung ?? null, e.beginn, e.ende ?? null, e.ganztaegig, e.ortName,
            e.adresse ?? null, punkt, ort.region, e.kategorien, e.preisText ?? null, e.gratis ?? null,
            e.bildUrl ?? null, e.freiluft ?? null, e.sicherheit, art === "termin", fp,
          ]
        );
        if (art === "termin") {
          statistik.terminGeaendert++;
          log(`  Termin geändert: ${e.titel} → ${tag}`);
        } else statistik.aktualisiert++;
      }
    } else {
      ({ rows } = await pool.query(
        `INSERT INTO events (titel, kurzbeschreibung, originalsprache, beginn, ende, ganztaegig, ort_name, adresse, geo,
            land, region, kategorien, preis_text, gratis, bild_url, freiluft, sicherheit, fingerabdruck)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::geography,$10,$11,$12,$13,$14,$15,$16,$17,$18)
         ON CONFLICT (fingerabdruck) DO UPDATE SET zuletzt_gesehen = now()
         RETURNING id`,
        [
          e.titel, e.beschreibung ?? null, e.originalsprache ?? "de", e.beginn, e.ende ?? null, e.ganztaegig,
          e.ortName, e.adresse ?? null, punkt, e.land, ort.region, e.kategorien, e.preisText ?? null,
          e.gratis ?? null, e.bildUrl ?? null, e.freiluft ?? null, e.sicherheit, fp,
        ]
      ));
      eventId = rows[0].id;
      statistik.neu++;
    }

    await pool.query(
      `INSERT INTO event_links (event_id, quelle_id, url) VALUES ($1, $2, $3) ON CONFLICT (event_id, url) DO NOTHING`,
      [eventId, e.quelleId, e.url]
    );
  }
}

/**
 * Events, die eine erfolgreich gelaufene Quelle zwei Läufe hintereinander nicht mehr geliefert hat,
 * werden als „verschwunden“ markiert (mögliche Absage). Nur innerhalb des Zeitraums, den die Quelle abdeckt.
 */
export async function verschwundeneMarkieren(
  quelleId: string,
  horizontTage: number,
  laufStart: Date
): Promise<number> {
  const { rows } = await db().query(
    `WITH weg AS (
       SELECT e.id FROM events e
        WHERE e.status IN ('aktiv', 'geaendert')
          AND e.von_nutzer = false
          AND e.beginn > now() AND e.beginn < now() + make_interval(days => $2)
          AND e.zuletzt_gesehen < $3::timestamptz - interval '30 hours'
          AND EXISTS (SELECT 1 FROM event_links l WHERE l.event_id = e.id AND l.quelle_id = $1)
          AND NOT EXISTS (SELECT 1 FROM event_links l WHERE l.event_id = e.id AND l.quelle_id IS DISTINCT FROM $1)
     ), upd AS (
       UPDATE events SET status = 'verschwunden', aktualisiert = now() WHERE id IN (SELECT id FROM weg) RETURNING id
     )
     INSERT INTO event_aenderungen (event_id, art) SELECT id, 'verschwunden' FROM upd RETURNING event_id`,
    [quelleId, horizontTage, laufStart]
  );
  return rows.length;
}
