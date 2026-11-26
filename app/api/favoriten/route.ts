import { sql } from "@/lib/db";
import { geraetAusAnfrage, nichtErlaubt } from "@/lib/geraet-server";
import { ladeEventsNachIds } from "@/lib/events-server";

// Gemerkte Events dieses Handys
export async function GET(req: Request) {
  const geraet = await geraetAusAnfrage(req);
  if (!geraet) return nichtErlaubt();
  const rows = (await sql().query("SELECT event_id, erinnern FROM favoriten WHERE geraet_id = $1", [geraet])) as {
    event_id: string;
    erinnern: boolean;
  }[];
  const ids = rows.map((r) => r.event_id);
  const ohneErinnerung = rows.filter((r) => !r.erinnern).map((r) => r.event_id);
  const events = await ladeEventsNachIds(ids);
  return Response.json({ ids, ohneErinnerung, events });
}

export async function POST(req: Request) {
  const geraet = await geraetAusAnfrage(req);
  if (!geraet) return nichtErlaubt();
  const { eventId, erinnern } = (await req.json().catch(() => ({}))) as { eventId?: string; erinnern?: boolean };
  if (!eventId || !/^[0-9a-f-]{36}$/i.test(eventId)) return Response.json({ fehler: "eventId fehlt" }, { status: 400 });
  await sql().query(
    "INSERT INTO favoriten (geraet_id, event_id, erinnern) VALUES ($1, $2, $3) ON CONFLICT (geraet_id, event_id) DO UPDATE SET erinnern = EXCLUDED.erinnern",
    [geraet, eventId, erinnern !== false]
  );
  return Response.json({ ok: true });
}

// Erinnerung für eine gemerkte Veranstaltung an- oder ausschalten
export async function PATCH(req: Request) {
  const geraet = await geraetAusAnfrage(req);
  if (!geraet) return nichtErlaubt();
  const { eventId, erinnern } = (await req.json().catch(() => ({}))) as { eventId?: string; erinnern?: boolean };
  if (!eventId || !/^[0-9a-f-]{36}$/i.test(eventId) || typeof erinnern !== "boolean") {
    return Response.json({ fehler: "eventId/erinnern fehlt" }, { status: 400 });
  }
  await sql().query("UPDATE favoriten SET erinnern = $3 WHERE geraet_id = $1 AND event_id = $2", [geraet, eventId, erinnern]);
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
