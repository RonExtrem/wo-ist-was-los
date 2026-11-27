// Aufräumen nach dem Sammeln: übersehene Doppelte zusammenführen, alte Einträge löschen.
// Lokal:  node --env-file=.env.local pipeline/aufraeumen.ts [--trocken]
import { db, dbSchliessen } from "./lib/db.ts";
import { gleichesEvent, kategorienVereinenSql, ortsWoerter } from "./lib/doppelte.ts";

/** So lange bleiben vergangene Events (für „Meine Events“, ausgegraut) – danach werden sie gelöscht. */
const AUFBEWAHREN_TAGE = 60;

/**
 * Dasselbe Event aus zwei verschiedenen Quellen, das beim Speichern nicht erkannt wurde
 * (z. B. weil die zweite Quelle zuerst lief). Das ältere bleibt, Links/Herzen/Erinnerungen wandern mit.
 */
export async function doppelteZusammenfuehren(trocken = false, log: (t: string) => void = console.log): Promise<number> {
  const pool = db();
  const { rows } = await pool.query(
    `SELECT a.id ia, b.id ib, a.titel ta, b.titel tb, a.ort_name oa, b.ort_name ob,
            ST_Distance(a.geo, b.geo) meter, a.erstellt <= b.erstellt a_aelter
       FROM events a JOIN events b ON a.id < b.id
        AND (b.beginn AT TIME ZONE 'Europe/Vienna')::date = (a.beginn AT TIME ZONE 'Europe/Vienna')::date
        AND ST_DWithin(a.geo, b.geo, 8000)
      WHERE coalesce(a.ende, a.beginn) > now() AND a.status <> 'verschwunden' AND NOT a.von_nutzer
        AND b.status <> 'verschwunden' AND NOT b.von_nutzer
        AND NOT EXISTS (SELECT 1 FROM event_links la JOIN event_links lb ON lb.quelle_id = la.quelle_id
                         WHERE la.event_id = a.id AND lb.event_id = b.id)`
  );
  const weg = new Set<string>();
  let n = 0;
  for (const r of rows) {
    if (weg.has(r.ia) || weg.has(r.ib)) continue;
    if (!gleichesEvent(r.ta, r.tb, Number(r.meter), false, ortsWoerter(r.oa, r.ob))) continue;
    const [bleibt, geht] = r.a_aelter ? [r.ia, r.ib] : [r.ib, r.ia];
    log(`  Doppelt: „${r.ta}“ = „${r.tb}“ (${Math.round(r.meter)} m)`);
    n++;
    weg.add(geht);
    if (trocken) continue;
    const c = await pool.connect();
    try {
      await c.query("BEGIN");
      await c.query(
        `INSERT INTO event_links (event_id, quelle_id, url) SELECT $1, quelle_id, url FROM event_links WHERE event_id = $2
         ON CONFLICT DO NOTHING`,
        [bleibt, geht]
      );
      await c.query(
        // „erinnern“ mitnehmen – sonst bekäme jemand, der „nur merken“ gewählt hat, plötzlich Erinnerungen
        `INSERT INTO favoriten (geraet_id, event_id, erstellt, erinnern)
         SELECT geraet_id, $1, erstellt, erinnern FROM favoriten WHERE event_id = $2
         ON CONFLICT DO NOTHING`,
        [bleibt, geht]
      );
      // Noch nicht gemeldete Änderungen (Absage, neuer Termin) nicht mit dem Doppelten löschen
      await c.query("UPDATE event_aenderungen SET event_id = $1 WHERE event_id = $2 AND NOT gemeldet", [bleibt, geht]);
      await c.query(
        `INSERT INTO erinnerungen (geraet_id, event_id, zeitpunkt, art, gesendet_am)
         SELECT geraet_id, $1, zeitpunkt, art, gesendet_am FROM erinnerungen WHERE event_id = $2 ON CONFLICT DO NOTHING`,
        [bleibt, geht]
      );
      await c.query(
        `UPDATE events k SET
           kurzbeschreibung = coalesce(k.kurzbeschreibung, g.kurzbeschreibung),
           preis_text = coalesce(k.preis_text, g.preis_text),
           bild_url = coalesce(k.bild_url, g.bild_url),
           ende = coalesce(k.ende, g.ende),
           kategorien = ${kategorienVereinenSql("k.kategorien", "g.kategorien")},
           zuletzt_gesehen = greatest(k.zuletzt_gesehen, g.zuletzt_gesehen)
         FROM events g WHERE k.id = $1 AND g.id = $2`,
        [bleibt, geht]
      );
      await c.query("DELETE FROM events WHERE id = $1", [geht]);
      await c.query("COMMIT");
    } catch (err) {
      await c.query("ROLLBACK");
      log(`  Zusammenführen fehlgeschlagen: ${(err as Error).message}`);
    } finally {
      c.release();
    }
  }
  return n;
}

/** Vergangene Events und alte Protokolle löschen, damit die Gratis-Datenbank nicht vollläuft. */
export async function altesLoeschen(trocken = false): Promise<{ events: number; laeufe: number; push: number }> {
  const pool = db();
  if (trocken) {
    const { rows } = await pool.query(
      `SELECT count(*)::int n FROM events WHERE coalesce(ende, beginn) < now() - make_interval(days => $1)`,
      [AUFBEWAHREN_TAGE]
    );
    return { events: rows[0].n, laeufe: 0, push: 0 };
  }
  const ev = await pool.query(`DELETE FROM events WHERE coalesce(ende, beginn) < now() - make_interval(days => $1)`, [
    AUFBEWAHREN_TAGE,
  ]);
  const la = await pool.query(`DELETE FROM sammler_laeufe WHERE gestartet < now() - interval '120 days'`);
  const pu = await pool.query(`DELETE FROM push_log WHERE gesendet_am < now() - interval '180 days'`);
  return { events: ev.rowCount ?? 0, laeufe: la.rowCount ?? 0, push: pu.rowCount ?? 0 };
}

export async function aufraeumen(trocken = false, log: (t: string) => void = console.log): Promise<void> {
  log("\n▶ Aufräumen");
  const doppelte = await doppelteZusammenfuehren(trocken, log);
  const alt = await altesLoeschen(trocken);
  log(
    `  ${doppelte} Doppelte zusammengeführt, ${alt.events} alte Events gelöscht` +
      (alt.laeufe || alt.push ? ` (+ ${alt.laeufe} alte Laufberichte, ${alt.push} alte Push-Einträge)` : "") +
      (trocken ? " – TROCKENLAUF, nichts geändert" : "")
  );
}

// Direkt aufgerufen?
if (process.argv[1]?.endsWith("aufraeumen.ts")) {
  aufraeumen(process.argv.includes("--trocken"))
    .then(() => dbSchliessen())
    .catch(async (err) => {
      console.error(err);
      await dbSchliessen();
      process.exit(1);
    });
}
