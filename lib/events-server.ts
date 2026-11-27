import "server-only";
import { sql } from "./db";
import type { EventDetail, EventFilter, EventKurz } from "./event-typ";
import { regionenAufloesen, regionId } from "./regionen";

type Zeile = Record<string, unknown>;

function zuKurz(r: Zeile): EventKurz {
  return {
    id: r.id as string,
    titel: r.titel as string,
    kurzbeschreibung: (r.kurzbeschreibung as string) ?? null,
    beginn: new Date(r.beginn as string).toISOString(),
    ende: r.ende ? new Date(r.ende as string).toISOString() : null,
    ganztaegig: r.ganztaegig as boolean,
    ortName: r.ort_name as string,
    land: r.land as EventKurz["land"],
    region: (r.region as string) ?? null,
    kategorien: (r.kategorien as string[]) ?? [],
    gratis: (r.gratis as boolean) ?? null,
    bildUrl: (r.bild_url as string) ?? null,
    sicherheit: r.sicherheit as EventKurz["sicherheit"],
    status: r.status as EventKurz["status"],
    lat: r.lat == null ? null : Number(r.lat),
    lng: r.lng == null ? null : Number(r.lng),
    entfernungKm: r.entfernung_km == null ? null : Math.round(Number(r.entfernung_km) * 10) / 10,
  };
}

const MAX_ERGEBNISSE = 400;

/**
 * Bis wann gilt ein Event als „noch nicht vorbei"? Ohne Ende: ganztägige bis Tagesende, sonst 2 Stunden nach Beginn
 * (vorher verschwand z. B. ein Adventmarkt ohne Endzeit schon um Mitternacht seines eigenen Tages).
 */
export const NOCH_NICHT_VORBEI_SQL = `coalesce(e.ende, e.beginn + CASE WHEN e.ganztaegig THEN interval '1 day' ELSE interval '2 hours' END)`;

/** Suchtext für ILIKE: %, _ und \ sind dort Platzhalter und werden darum maskiert. */
function suchMuster(text: string | undefined): string | null {
  const t = text?.trim();
  return t ? `%${t.replace(/[\\%_]/g, (z) => "\\" + z)}%` : null;
}

/** Events um einen Punkt, nach Zeitraum und Filtern, sortiert nach Beginn. */
export async function ladeEvents(f: EventFilter): Promise<EventKurz[]> {
  const db = sql();
  const suche = suchMuster(f.suche);
  const reg = regionenAufloesen(f.regionen ?? []);
  const rows = await db.query(
    `SELECT e.id, e.titel, e.kurzbeschreibung, e.beginn, e.ende, e.ganztaegig, e.ort_name, e.land, e.region,
            e.kategorien, e.gratis, e.bild_url, e.sicherheit, e.status,
            ST_Y(e.geo::geometry) AS lat, ST_X(e.geo::geometry) AS lng,
            ST_Distance(e.geo, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography) / 1000.0 AS entfernung_km
       FROM events e
      WHERE e.status <> 'verschwunden'
        AND e.geo IS NOT NULL
        AND ${NOCH_NICHT_VORBEI_SQL} >= $4::timestamptz
        AND e.beginn <= $5::timestamptz
        AND ($3::float8 IS NULL OR ST_DWithin(e.geo, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography, $3::float8 * 1000))
        AND ($6::text[] IS NULL OR e.kategorien && $6::text[])
        AND ($7::text[] IS NULL OR e.land = ANY($7::text[]))
        AND (NOT $8::boolean OR e.gratis = true)
        AND ($9::text IS NULL OR e.titel ILIKE $9 OR e.ort_name ILIKE $9 OR e.kurzbeschreibung ILIKE $9)
        AND ($10::int IS NULL OR e.erstellt >= now() - make_interval(days => $10::int))
        AND ($11::text[] IS NULL OR e.region = ANY($11::text[]) OR e.land <> ALL($12::text[]))
      ORDER BY e.beginn, entfernung_km
      LIMIT ${Math.min(Math.max(Math.round(f.max ?? MAX_ERGEBNISSE), 1), 3000)}`,
    [
      f.lat,
      f.lng,
      f.radiusKm,
      f.von,
      f.bis,
      f.kategorien?.length ? f.kategorien : null,
      f.laender?.length ? f.laender : null,
      !!f.nurGratis,
      suche,
      f.neuTage ? Math.min(Math.max(Math.round(f.neuTage), 1), 30) : null,
      reg.db.length ? reg.db : null,
      reg.laender,
    ]
  );
  return (rows as Zeile[]).map(zuKurz);
}

/**
 * Wie viele Events pro Land und Bundesland/Region.
 * Länder zählen im Umkreis (falls angegeben) – so viele zeigt die Liste nach dem Antippen.
 * Bundesländer zählen ohne Umkreis, weil ein gewähltes Bundesland den Umkreis ersetzt.
 */
export async function zaehleRegionen(
  f: Omit<EventFilter, "lat" | "lng" | "radiusKm" | "laender" | "regionen" | "max"> & { lat?: number; lng?: number; radiusKm?: number | null }
): Promise<Record<string, number>> {
  const mitUmkreis = f.lat != null && f.lng != null && f.radiusKm != null;
  const rows = (await sql().query(
    `SELECT e.land, e.region, count(*)::int AS n,
            count(*) FILTER (WHERE $7::float8 IS NULL
              OR ST_DWithin(e.geo, ST_SetSRID(ST_MakePoint($9, $8), 4326)::geography, $7::float8 * 1000))::int AS n_umkreis
       FROM events e
      WHERE e.status <> 'verschwunden'
        AND e.geo IS NOT NULL
        AND ${NOCH_NICHT_VORBEI_SQL} >= $1::timestamptz
        AND e.beginn <= $2::timestamptz
        AND ($3::text[] IS NULL OR e.kategorien && $3::text[])
        AND (NOT $4::boolean OR e.gratis = true)
        AND ($5::text IS NULL OR e.titel ILIKE $5 OR e.ort_name ILIKE $5 OR e.kurzbeschreibung ILIKE $5)
        AND ($6::int IS NULL OR e.erstellt >= now() - make_interval(days => $6::int))
      GROUP BY 1, 2`,
    [
      f.von,
      f.bis,
      f.kategorien?.length ? f.kategorien : null,
      !!f.nurGratis,
      suchMuster(f.suche),
      f.neuTage ? Math.min(Math.max(Math.round(f.neuTage), 1), 30) : null,
      mitUmkreis ? f.radiusKm : null,
      mitUmkreis ? f.lat : 0,
      mitUmkreis ? f.lng : 0,
    ]
  )) as { land: string; region: string | null; n: number; n_umkreis: number }[];
  const zahlen: Record<string, number> = {};
  for (const r of rows) {
    zahlen[r.land] = (zahlen[r.land] ?? 0) + r.n_umkreis;
    const id = regionId(r.land, r.region);
    if (id) zahlen[id] = (zahlen[id] ?? 0) + r.n;
  }
  return zahlen;
}

export async function ladeEvent(id: string): Promise<EventDetail | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const db = sql();
  const rows = (await db.query(
    `SELECT e.*, ST_Y(e.geo::geometry) AS lat, ST_X(e.geo::geometry) AS lng, NULL AS entfernung_km
       FROM events e WHERE e.id = $1`,
    [id]
  )) as Zeile[];
  if (!rows[0]) return null;
  const links = (await db.query(
    `SELECT l.url, q.name AS quelle FROM event_links l LEFT JOIN quellen q ON q.id = l.quelle_id WHERE l.event_id = $1`,
    [id]
  )) as { url: string; quelle: string | null }[];
  const r = rows[0];
  return {
    ...zuKurz(r),
    adresse: (r.adresse as string) ?? null,
    preisText: (r.preis_text as string) ?? null,
    freiluft: (r.freiluft as boolean) ?? null,
    originalsprache: r.originalsprache as string,
    links,
  };
}

export async function ladeEventsNachIds(ids: string[]): Promise<EventKurz[]> {
  const gueltig = ids.filter((id) => /^[0-9a-f-]{36}$/i.test(id));
  if (!gueltig.length) return [];
  const rows = (await sql().query(
    `SELECT e.id, e.titel, e.kurzbeschreibung, e.beginn, e.ende, e.ganztaegig, e.ort_name, e.land, e.region,
            e.kategorien, e.gratis, e.bild_url, e.sicherheit, e.status,
            ST_Y(e.geo::geometry) AS lat, ST_X(e.geo::geometry) AS lng, NULL AS entfernung_km
       FROM events e WHERE e.id = ANY($1::uuid[]) ORDER BY e.beginn`,
    [gueltig]
  )) as Zeile[];
  return rows.map(zuKurz);
}
