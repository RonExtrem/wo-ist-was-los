import "server-only";
import { sql } from "./db";

const KENNUNG = "Mozilla/5.0 (compatible; WoIsWosLos/0.1; private Familien-App)";

export interface Ort {
  lat: number;
  lng: number;
  region: string | null;
  land: string | null; // „AT“, „SI“, „IT“ …
}

/** Ort/Adresse → Koordinaten (Nominatim, Ergebnisse werden gemerkt). */
export async function ortFinden(anfrage: string): Promise<Ort | null> {
  const q = anfrage.trim().slice(0, 160);
  if (q.length < 2) return null;
  const schluessel = `teilen:${q.toLowerCase()}`;
  const db = sql();
  const cache = (await db.query("SELECT lat, lng, region, land FROM geocode_cache WHERE anfrage = $1", [schluessel])) as Ort[];
  if (cache[0]) return cache[0].lat == null ? null : cache[0];

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "at,si,it,de");
  url.searchParams.set("accept-language", "de");
  try {
    const res = await fetch(url, { headers: { "User-Agent": KENNUNG }, signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return null;
    const d = ((await res.json()) as { lat: string; lon: string; address?: Record<string, string> }[])[0];
    const ort: Ort | null = d
      ? { lat: Number(d.lat), lng: Number(d.lon), region: d.address?.state ?? (d.address?.city === "Wien" ? "Wien" : null) /* Wien ist Stadt und Land zugleich */, land: d.address?.country_code?.toUpperCase() ?? null }
      : null;
    await db.query(
      "INSERT INTO geocode_cache (anfrage, lat, lng, region, land) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (anfrage) DO NOTHING",
      [schluessel, ort?.lat ?? null, ort?.lng ?? null, ort?.region ?? null, ort?.land ?? null]
    );
    return ort;
  } catch {
    return null;
  }
}
