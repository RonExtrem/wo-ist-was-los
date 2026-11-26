import { sql } from "@/lib/db";
import { geraetAusAnfrage, nichtErlaubt } from "@/lib/geraet-server";

// Quellen-Status (Ampel) – keine persönlichen Daten, nur Zahlen pro Quelle
export async function GET(req: Request) {
  const db = sql();
  const quellen = await db.query(
    `SELECT id, name, url, aktiv, letzter_lauf, gefunden_letzter_lauf, round(durchschnitt, 1) AS durchschnitt,
            schlechte_naechte, letzter_fehler
       FROM quellen ORDER BY schlechte_naechte DESC, name`
  );
  const laeufe = await db.query(
    "SELECT gestartet, beendet FROM sammler_laeufe ORDER BY gestartet DESC LIMIT 5"
  );
  const zahlen = (await db.query(
    "SELECT count(*) FILTER (WHERE coalesce(ende, beginn) >= now())::int AS kommend, count(*)::int AS gesamt FROM events WHERE status <> 'verschwunden'"
  )) as { kommend: number; gesamt: number }[];
  const geraet = await geraetAusAnfrage(req);
  const admin = geraet
    ? (((await db.query("SELECT ist_admin FROM geraete WHERE id = $1", [geraet])) as { ist_admin: boolean }[])[0]?.ist_admin ?? false)
    : false;
  return Response.json({ quellen, laeufe, events: zahlen[0], admin });
}

// Dieses Handy bekommt Warnungen, wenn Quellen ausfallen (für Michi)
export async function POST(req: Request) {
  const geraet = await geraetAusAnfrage(req);
  if (!geraet) return nichtErlaubt();
  const { an } = (await req.json().catch(() => ({}))) as { an?: boolean };
  await sql().query("UPDATE geraete SET ist_admin = $2 WHERE id = $1", [geraet, an !== false]);
  return Response.json({ ok: true });
}
