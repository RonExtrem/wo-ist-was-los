import type { NextRequest } from "next/server";
import { zaehleRegionen } from "@/lib/events-server";

function liste(v: string | null): string[] | undefined {
  const l = v?.split(",").map((s) => s.trim()).filter(Boolean);
  return l?.length ? l : undefined;
}

// GET /api/regionen?von=ISO&bis=ISO&kat=a,b&gratis=1&q=text&neu=7 → { zahlen: { AT: 123, Kärnten: 45, … } }
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const von = p.get("von");
  const bis = p.get("bis");
  if (!von || !bis || Number.isNaN(Date.parse(von)) || Number.isNaN(Date.parse(bis))) {
    return Response.json({ fehler: "Datum ungültig" }, { status: 400 });
  }
  const neu = Number(p.get("neu"));
  try {
    const zahlen = await zaehleRegionen({
      von,
      bis,
      kategorien: liste(p.get("kat")),
      nurGratis: p.get("gratis") === "1",
      suche: p.get("q")?.slice(0, 80),
      neuTage: Number.isFinite(neu) && neu > 0 ? neu : undefined,
    });
    return Response.json({ zahlen }, { headers: { "Cache-Control": "private, max-age=120" } });
  } catch (err) {
    console.error(err);
    return Response.json({ fehler: "Datenbank nicht erreichbar" }, { status: 503 });
  }
}
