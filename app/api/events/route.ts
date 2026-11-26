import type { NextRequest } from "next/server";
import { ladeEvents } from "@/lib/events-server";

function zahl(v: string | null, standard: number | null): number | null {
  if (v == null || v === "") return standard;
  const n = Number(v);
  return Number.isFinite(n) ? n : standard;
}

function liste(v: string | null): string[] | undefined {
  const l = v?.split(",").map((s) => s.trim()).filter(Boolean);
  return l?.length ? l : undefined;
}

// GET /api/events?lat=..&lng=..&radius=50&von=ISO&bis=ISO&kat=a,b&land=AT,SI&gratis=1&q=text
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const lat = zahl(p.get("lat"), null);
  const lng = zahl(p.get("lng"), null);
  if (lat == null || lng == null || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return Response.json({ fehler: "lat/lng fehlen" }, { status: 400 });
  }
  const jetzt = new Date();
  const von = p.get("von") ?? jetzt.toISOString();
  const bis = p.get("bis") ?? new Date(jetzt.getTime() + 30 * 86_400_000).toISOString();
  if (Number.isNaN(Date.parse(von)) || Number.isNaN(Date.parse(bis))) {
    return Response.json({ fehler: "Datum ungültig" }, { status: 400 });
  }
  const radius = p.get("radius") === "alle" ? null : zahl(p.get("radius"), 50);

  try {
    const events = await ladeEvents({
      lat,
      lng,
      radiusKm: radius,
      von,
      bis,
      kategorien: liste(p.get("kat")),
      laender: liste(p.get("land")),
      regionen: liste(p.get("region")),
      nurGratis: p.get("gratis") === "1",
      suche: p.get("q")?.slice(0, 80),
      neuTage: zahl(p.get("neu"), null) ?? undefined,
      max: zahl(p.get("max"), null) ?? undefined,
    });
    return Response.json({ events }, { headers: { "Cache-Control": "private, max-age=120" } });
  } catch (err) {
    console.error(err);
    return Response.json({ fehler: "Datenbank nicht erreichbar" }, { status: 503 });
  }
}
