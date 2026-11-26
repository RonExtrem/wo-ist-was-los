import { sql } from "@/lib/db";
import { geraetAusAnfrage, nichtErlaubt } from "@/lib/geraet-server";
import { pushBereit, sendePush } from "@/lib/push-server";

// Test-Nachricht an das eigene Handy (höchstens 5× am Tag)
export async function POST(req: Request) {
  const geraet = await geraetAusAnfrage(req);
  if (!geraet) return nichtErlaubt();
  if (!pushBereit()) return Response.json({ fehler: "Der Server ist für Nachrichten noch nicht eingerichtet." }, { status: 503 });
  const heute = (await sql().query(
    "SELECT count(*)::int AS n FROM push_log WHERE geraet_id = $1 AND art = 'test' AND gesendet_am > now() - interval '1 day'",
    [geraet]
  )) as { n: number }[];
  if (heute[0].n >= 5) return Response.json({ fehler: "Heute schon genug Test-Nachrichten 🙂" }, { status: 429 });
  const n = await sendePush(
    geraet,
    { title: "Servus! 👋", body: "Die Benachrichtigungen funktionieren. So kommen auch die Erinnerungen an.", url: "/", tag: "test" },
    "test"
  );
  return n ? Response.json({ ok: true }) : Response.json({ fehler: "Das Handy ist nicht angemeldet. Bitte Benachrichtigungen einschalten." }, { status: 404 });
}
