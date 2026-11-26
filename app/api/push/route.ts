import { sql } from "@/lib/db";
import { geraetAusAnfrage, nichtErlaubt } from "@/lib/geraet-server";

interface Abo {
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
}

// Handy für Push-Nachrichten anmelden
export async function POST(req: Request) {
  const geraet = await geraetAusAnfrage(req);
  if (!geraet) return nichtErlaubt();
  const abo = (await req.json().catch(() => ({}))) as Abo;
  const endpoint = abo.endpoint ?? "";
  if (!/^https:\/\//.test(endpoint) || endpoint.length > 1000 || !abo.keys?.p256dh || !abo.keys?.auth) {
    return Response.json({ fehler: "Ungültiges Abo" }, { status: 400 });
  }
  await sql().query(
    `INSERT INTO push_abos (geraet_id, endpoint, p256dh, auth) VALUES ($1, $2, $3, $4)
     ON CONFLICT (endpoint) DO UPDATE SET geraet_id = EXCLUDED.geraet_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth`,
    [geraet, endpoint, abo.keys.p256dh.slice(0, 200), abo.keys.auth.slice(0, 100)]
  );
  return Response.json({ ok: true });
}

// Abmelden
export async function DELETE(req: Request) {
  const geraet = await geraetAusAnfrage(req);
  if (!geraet) return nichtErlaubt();
  const { endpoint } = (await req.json().catch(() => ({}))) as { endpoint?: string };
  if (endpoint) await sql().query("DELETE FROM push_abos WHERE geraet_id = $1 AND endpoint = $2", [geraet, endpoint]);
  return Response.json({ ok: true });
}
