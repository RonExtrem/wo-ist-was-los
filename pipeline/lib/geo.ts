// Ortssuche über Nominatim (OpenStreetMap) – höchstens 1 Abfrage pro Sekunde, Ergebnisse werden gespeichert.
import { db } from "./db.ts";
import { KENNUNG } from "./http.ts";

export interface Ort {
  lat: number;
  lng: number;
  region: string | null;
  land: string | null;
}

let letzteAbfrage = 0;
const warte = (ms: number) => new Promise((r) => setTimeout(r, ms));

function schluessel(anfrage: string): string {
  return anfrage.toLowerCase().replace(/\s+/g, " ").replace(/[,;]+/g, ",").trim();
}

/** Koordinaten zu einer Adresse. null, wenn nichts gefunden wurde (wird ebenfalls gemerkt). */
export async function ortSuchen(anfrage: string): Promise<Ort | null> {
  const key = schluessel(anfrage);
  if (!key) return null;

  const { rows } = await db().query("SELECT lat, lng, region, land FROM geocode_cache WHERE anfrage = $1", [key]);
  if (rows.length) {
    const r = rows[0];
    return r.lat == null ? null : { lat: r.lat, lng: r.lng, region: r.region, land: r.land };
  }

  const seit = Date.now() - letzteAbfrage;
  if (seit < 1100) await warte(1100 - seit);
  letzteAbfrage = Date.now();

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", anfrage);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "at,si,it");
  url.searchParams.set("accept-language", "de");

  let ort: Ort | null = null;
  try {
    const res = await fetch(url, { headers: { "User-Agent": KENNUNG }, signal: AbortSignal.timeout(20_000) });
    if (res.ok) {
      const daten = (await res.json()) as Array<{ lat: string; lon: string; address?: Record<string, string> }>;
      if (daten[0]) {
        const a = daten[0].address ?? {};
        ort = {
          lat: Number(daten[0].lat),
          lng: Number(daten[0].lon),
          region: a.state ?? a.region ?? null,
          land: a.country_code ? a.country_code.toUpperCase() : null,
        };
      }
    } else if (res.status === 429) {
      return null; // nicht merken, nächstes Mal neu versuchen
    }
  } catch {
    return null;
  }

  await db().query(
    "INSERT INTO geocode_cache (anfrage, lat, lng, region, land) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (anfrage) DO NOTHING",
    [key, ort?.lat ?? null, ort?.lng ?? null, ort?.region ?? null, ort?.land ?? null]
  );
  return ort;
}

/** Luftlinie in km. */
export function abstandKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const r = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(x));
}

/** Mittelpunkte für die 150-km-Grenze: Klagenfurt und Spittal an der Drau (Papas Wohnort). */
export const KLAGENFURT = { lat: 46.6247, lng: 14.3053 };
export const SPITTAL = { lat: 46.7989, lng: 13.4955 };
export const SAMMEL_RADIUS_KM = 150;

export function imSammelgebiet(p: { lat: number; lng: number }): boolean {
  return abstandKm(p, KLAGENFURT) <= SAMMEL_RADIUS_KM || abstandKm(p, SPITTAL) <= SAMMEL_RADIUS_KM;
}
