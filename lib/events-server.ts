import "server-only";
import { sql } from "./db";
import type { EventDetail, EventFilter, EventKurz } from "./event-typ";

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

/** Events um einen Punkt, nach Zeitraum und Filtern, sortiert nach Beginn. */
export async function ladeEvents(f: EventFilter): Promise<EventKurz[]> {
  const db = sql();
  const suche = f.suche?.trim() ? `%${f.suche.trim()}%` : null;
  const rows = await db.query(
    `SELECT e.id, e.titel, e.kurzbeschreibung, e.beginn, e.ende, e.ganztaegig, e.ort_name, e.land, e.region,
            e.kategorien, e.gratis, e.bild_url, e.sicherheit, e.status,
            ST_Y(e.geo::geometry) AS lat, ST_X(e.geo::geometry) AS lng,
            ST_Distance(e.geo, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography) / 1000.0 AS entfernung_km
       FROM events e
      WHERE e.status <> 'verschwunden'
        AND e.geo IS NOT NULL
        AND coalesce(e.ende, e.beginn) >= $4::timestamptz
        AND e.beginn <= $5::timestamptz
        AND ($3::float8 IS NULL OR ST_DWithin(e.geo, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography, $3::float8 * 1000))
        AND ($6::text[] IS NULL OR e.kategorien && $6::text[])
        AND ($7::text[] IS NULL OR e.land = ANY($7::text[]))
        AND (NOT $8::boolean OR e.gratis = true)
        AND ($9::text IS NULL OR e.titel ILIKE $9 OR e.ort_name ILIKE $9 OR e.kurzbeschreibung ILIKE $9)
        AND ($10::int IS NULL OR e.erstellt >= now() - make_interval(days => $10::int))
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
    ]
  );
  return (rows as Zeile[]).map(zuKurz);
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
