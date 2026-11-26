import { sql } from "@/lib/db";
import { geraetAusAnfrage, nichtErlaubt } from "@/lib/geraet-server";
import { KATEGORIEN } from "@/lib/kategorien";

const KAT_IDS = new Set<string>(KATEGORIEN.map((k) => k.id));

export async function GET(req: Request) {
  const geraet = await geraetAusAnfrage(req);
  if (!geraet) return nichtErlaubt();
  const rows = (await sql().query(
    `SELECT name, wohnort_name, ST_Y(wohnort::geometry) AS lat, ST_X(wohnort::geometry) AS lng, umkreis_km, interessen,
            schriftgroesse, theme, erinnern, neu_fuer_dich, seltener, wochenend_tipp FROM einstellungen WHERE geraet_id = $1`,
    [geraet]
  )) as Record<string, unknown>[];
  return Response.json({ einstellungen: rows[0] ?? null });
}

// Einstellungen vom Handy übernehmen (das Handy ist die „Wahrheit“, der Server braucht sie für Push-Nachrichten)
export async function PUT(req: Request) {
  const geraet = await geraetAusAnfrage(req);
  if (!geraet) return nichtErlaubt();
  const e = (await req.json().catch(() => ({}))) as {
    name?: string;
    wohnortName?: string;
    lat?: number;
    lng?: number;
    umkreisKm?: number;
    interessen?: string[];
    schriftgroesse?: string;
    theme?: string;
    erinnern?: boolean;
    neuFuerDich?: string;
    wochenendTipp?: boolean;
  };
  const interessen = (e.interessen ?? []).filter((k) => KAT_IDS.has(k));
  const schrift = ["normal", "gross", "sehr_gross"].includes(e.schriftgroesse ?? "") ? e.schriftgroesse : "gross";
  const theme = ["auto", "hell", "dunkel"].includes(e.theme ?? "") ? e.theme : "auto";
  const umkreis = Math.min(Math.max(Number(e.umkreisKm) || 50, 5), 500);
  const neu = ["taeglich", "seltener", "aus"].includes(e.neuFuerDich ?? "") ? e.neuFuerDich : "taeglich";
  const hatOrt = Number.isFinite(e.lat) && Number.isFinite(e.lng);
  await sql().query(
    `INSERT INTO einstellungen (geraet_id, wohnort_name, wohnort, umkreis_km, interessen, schriftgroesse, theme,
                                erinnern, neu_fuer_dich, seltener, wochenend_tipp, name, aktualisiert)
     VALUES ($1, $2, CASE WHEN $3 THEN ST_SetSRID(ST_MakePoint($5, $4), 4326)::geography END, $6, $7, $8, $9,
             $10, $11, $12, $13, $14, now())
     ON CONFLICT (geraet_id) DO UPDATE SET
       wohnort_name = coalesce(EXCLUDED.wohnort_name, einstellungen.wohnort_name),
       wohnort = coalesce(EXCLUDED.wohnort, einstellungen.wohnort),
       umkreis_km = EXCLUDED.umkreis_km, interessen = EXCLUDED.interessen,
       schriftgroesse = EXCLUDED.schriftgroesse, theme = EXCLUDED.theme,
       erinnern = EXCLUDED.erinnern, neu_fuer_dich = EXCLUDED.neu_fuer_dich, seltener = EXCLUDED.seltener,
       wochenend_tipp = EXCLUDED.wochenend_tipp, name = EXCLUDED.name, aktualisiert = now()`,
    [
      geraet, e.wohnortName?.slice(0, 120) ?? null, hatOrt, e.lat ?? 0, e.lng ?? 0, umkreis, interessen, schrift, theme,
      e.erinnern !== false, neu !== "aus", neu === "seltener", e.wochenendTipp !== false,
      e.name?.trim().slice(0, 40) || null,
    ]
  );
  return Response.json({ ok: true });
}
