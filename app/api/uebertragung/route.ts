import { randomInt } from "node:crypto";
import { sql } from "@/lib/db";
import { geraetAusAnfrage, nichtErlaubt } from "@/lib/geraet-server";

// Übertragungscode für einen Handywechsel, z. B. „GAMS-4821“ (14 Tage gültig)
const WOERTER = [
  "ADLER", "BIBER", "DACHS", "EULE", "FUCHS", "GAMS", "HIRSCH", "IGEL", "KAUZ", "LUCHS", "MURMEL", "REH",
  "SPECHT", "FORELLE", "WIESEL", "STORCH", "AMSEL", "FINK", "HASE", "BIENE",
];

export async function GET(req: Request) {
  const geraet = await geraetAusAnfrage(req);
  if (!geraet) return nichtErlaubt();
  const db = sql();
  const da = (await db.query(
    "SELECT uebertragungscode, code_gueltig_bis FROM geraete WHERE id = $1 AND code_gueltig_bis > now() + interval '1 day'",
    [geraet]
  )) as { uebertragungscode: string; code_gueltig_bis: string }[];
  if (da[0]?.uebertragungscode) return Response.json({ code: da[0].uebertragungscode, gueltigBis: da[0].code_gueltig_bis });

  for (let i = 0; i < 10; i++) {
    const code = `${WOERTER[randomInt(WOERTER.length)]}-${randomInt(1000, 10000)}`;
    try {
      const r = (await db.query(
        "UPDATE geraete SET uebertragungscode = $2, code_gueltig_bis = now() + interval '14 days' WHERE id = $1 RETURNING code_gueltig_bis",
        [geraet, code]
      )) as { code_gueltig_bis: string }[];
      return Response.json({ code, gueltigBis: r[0].code_gueltig_bis });
    } catch {
      /* Code schon vergeben → neuen würfeln */
    }
  }
  return Response.json({ fehler: "Bitte nochmal probieren" }, { status: 500 });
}

// Code vom alten Handy eingeben → Gemerktes und Einstellungen übernehmen
export async function POST(req: Request) {
  const geraet = await geraetAusAnfrage(req);
  if (!geraet) return nichtErlaubt();
  const { code } = (await req.json().catch(() => ({}))) as { code?: string };
  const sauber = (code ?? "").toUpperCase().replace(/\s+/g, "").replace(/[–—]/g, "-");
  if (!/^[A-ZÄÖÜ]{3,10}-?\d{4}$/.test(sauber)) return Response.json({ fehler: "So sieht der Code nicht aus (z. B. GAMS-4821)." }, { status: 400 });
  const mitStrich = sauber.includes("-") ? sauber : sauber.replace(/(\d{4})$/, "-$1");
  const db = sql();
  const alt = (await db.query("SELECT id FROM geraete WHERE uebertragungscode = $1 AND code_gueltig_bis > now()", [mitStrich])) as {
    id: string;
  }[];
  if (!alt[0]) return Response.json({ fehler: "Diesen Code gibt es nicht (mehr). Bitte am alten Handy nachschauen." }, { status: 404 });
  if (alt[0].id === geraet) return Response.json({ fehler: "Das ist der Code von diesem Handy." }, { status: 400 });

  await db.query(
    "INSERT INTO favoriten (geraet_id, event_id, erstellt, erinnern) SELECT $1, event_id, erstellt, erinnern FROM favoriten WHERE geraet_id = $2 ON CONFLICT DO NOTHING",
    [geraet, alt[0].id]
  );
  const e = (await db.query(
    `SELECT name, wohnort_name, ST_Y(wohnort::geometry) AS lat, ST_X(wohnort::geometry) AS lng, umkreis_km, interessen, schriftgroesse,
            theme, erinnern, neu_fuer_dich, seltener, wochenend_tipp
       FROM einstellungen WHERE geraet_id = $1`,
    [alt[0].id]
  )) as Record<string, unknown>[];
  await db.query("UPDATE geraete SET uebertragungscode = NULL, code_gueltig_bis = NULL WHERE id = $1", [alt[0].id]);
  const r = e[0];
  return Response.json({
    ok: true,
    einstellungen: r
      ? {
          name: r.name ?? "",
          eingerichtet: true,
          wohnortName: r.wohnort_name,
          lat: r.lat,
          lng: r.lng,
          umkreisKm: r.umkreis_km,
          interessen: r.interessen,
          schriftgroesse: r.schriftgroesse,
          theme: r.theme,
          erinnern: r.erinnern,
          neuFuerDich: !r.neu_fuer_dich ? "aus" : r.seltener ? "seltener" : "taeglich",
          wochenendTipp: r.wochenend_tipp,
        }
      : null,
  });
}
