import { sql } from "@/lib/db";
import { geraetAusAnfrage, nichtErlaubt } from "@/lib/geraet-server";
import { ladeEventsNachIds } from "@/lib/events-server";

// Gemerkte Events dieses Handys
export async function GET(req: Request) {
  const geraet = await geraetAusAnfrage(req);
  if (!geraet) return nichtErlaubt();
  const rows = (await sql().query("SELECT event_id FROM favoriten WHERE geraet_id = $1", [geraet])) as { event_id: string }[];
  const ids = rows.map((r) => r.event_id);
  const events = await ladeEventsNachIds(ids);
  return Response.json({ ids, events });
}

export async function POST(req: Request) {
  const geraet = await geraetAusAnfrage(req);
  if (!geraet) return nichtErlaubt();
  const { eventId } = (await req.json().catch(() => ({}))) as { eventId?: string };
  if (!eventId || !/^[0-9a-f-]{36}$/i.test(eventId)) return Response.json({ fehler: "eventId fehlt" }, { status: 400 });
  await sql().query(
    "INSERT INTO favoriten (geraet_id, event_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
    [geraet, eventId]
  );
  return Response.json({ ok: true });
}

export async function DELETE(req: Request) {
  const geraet = await geraetAusAnfrage(req);
  if (!geraet) return nichtErlaubt();
  const eventId = new URL(req.url).searchParams.get("eventId");
  if (!eventId) return Response.json({ fehler: "eventId fehlt" }, { status: 400 });
  await sql().query("DELETE FROM favoriten WHERE geraet_id = $1 AND event_id = $2", [geraet, eventId]);
  return Response.json({ ok: true });
}
