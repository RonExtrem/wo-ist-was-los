import type { NextRequest } from "next/server";
import { sql } from "@/lib/db";

const KENNUNG = "Mozilla/5.0 (compatible; WoIsWosLos/0.1; private Familien-App)";

// Ortssuche für „Anderer Ort…“ (Nominatim, Ergebnisse werden gemerkt)
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim().slice(0, 100);
  if (!q || q.length < 2) return Response.json({ orte: [] });
  const schluessel = `app:${q.toLowerCase()}`;
  const db = sql();

  const cache = (await db.query("SELECT lat, lng, region FROM geocode_cache WHERE anfrage = $1", [schluessel])) as {
    lat: number | null;
    lng: number | null;
    region: string | null;
  }[];
  if (cache[0]?.lat != null) {
    return Response.json({ orte: [{ name: q, lat: cache[0].lat, lng: cache[0].lng, region: cache[0].region }] });
  }

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "5");
  url.searchParams.set("countrycodes", "at,si,it,de");
  url.searchParams.set("accept-language", "de");
  url.searchParams.set("featureType", "settlement");

  try {
    const res = await fetch(url, { headers: { "User-Agent": KENNUNG }, signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return Response.json({ orte: [] });
    const daten = (await res.json()) as { lat: string; lon: string; name?: string; display_name: string; address?: Record<string, string> }[];
    const orte = daten.map((d) => ({
      name: d.name || d.display_name.split(",")[0],
      lat: Number(d.lat),
      lng: Number(d.lon),
      region: d.address?.state ?? null,
      zusatz: [d.address?.state, d.address?.country].filter(Boolean).join(", "),
    }));
    if (orte[0]) {
      await db.query(
        "INSERT INTO geocode_cache (anfrage, lat, lng, region) VALUES ($1,$2,$3,$4) ON CONFLICT (anfrage) DO NOTHING",
        [schluessel, orte[0].lat, orte[0].lng, orte[0].region]
      );
    }
    return Response.json({ orte });
  } catch {
    return Response.json({ orte: [] });
  }
}
