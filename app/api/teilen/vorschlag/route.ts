import { sql } from "@/lib/db";
import { geraetAusAnfrage, nichtErlaubt } from "@/lib/geraet-server";
import { kiBereit, kiJson } from "@/lib/ki-server";
import { KATEGORIEN } from "@/lib/kategorien";
import { wienTag } from "@/lib/datum";
import { seitenText } from "@/pipeline/lib/seitentext";

export const maxDuration = 60;

const KENNUNG = "Mozilla/5.0 (compatible; WoIsWosLos/0.1; private Familien-App)";
const PRO_TAG = 20; // KI-Vorschläge pro Handy und Tag (Schutz vor Missbrauch)

export interface Vorschlag {
  gefunden: boolean;
  titel: string;
  datum: string; // YYYY-MM-DD
  uhrzeit: string; // HH:MM oder ""
  datumEnde: string;
  ort: string;
  adresse: string;
  kategorie: string;
  kurzbeschreibung: string;
  preisText: string;
  gratis: boolean | null;
  freiluft: boolean | null;
  bildUrl: string;
}

const SCHEMA = {
  type: "OBJECT",
  properties: {
    gefunden: { type: "BOOLEAN", description: "true, wenn eine konkrete Veranstaltung mit Datum erkennbar ist" },
    titel: { type: "STRING", description: "Name der Veranstaltung auf Deutsch" },
    datum: { type: "STRING", description: "Beginn YYYY-MM-DD oder leer" },
    uhrzeit: { type: "STRING", description: "Beginn HH:MM oder leer" },
    datumEnde: { type: "STRING", description: "letzter Tag YYYY-MM-DD bei mehrtägigen, sonst leer" },
    ort: { type: "STRING", description: "Gemeinde/Stadt, z. B. „Spittal an der Drau“" },
    adresse: { type: "STRING", description: "Lokal, Platz oder Straße, falls genannt, sonst leer" },
    kategorie: { type: "STRING", enum: KATEGORIEN.map((k) => k.id) },
    kurzbeschreibung: { type: "STRING", description: "1–2 Sätze auf Deutsch, eigene Worte" },
    preisText: { type: "STRING", description: "z. B. „Eintritt 12 €“ oder leer" },
    gratis: { type: "BOOLEAN", nullable: true },
    freiluft: { type: "BOOLEAN", nullable: true, description: "findet im Freien statt?" },
    bildUrl: { type: "STRING", description: "Bild-URL aus der Seite (og:image) oder leer" },
  },
  required: ["gefunden", "titel", "datum", "uhrzeit", "datumEnde", "ort", "adresse", "kategorie", "kurzbeschreibung", "preisText", "bildUrl"],
};

async function seiteLesen(url: string): Promise<{ text: string; bild: string }> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": KENNUNG, "Accept-Language": "de-AT,de;q=0.9" },
      signal: AbortSignal.timeout(10_000),
      redirect: "follow",
    });
    if (!res.ok || !(res.headers.get("content-type") ?? "").includes("html")) return { text: "", bild: "" };
    const html = (await res.text()).slice(0, 1_500_000);
    const bild = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i)?.[1] ?? "";
    return { text: seitenText(html, url, 15_000), bild };
  } catch {
    return { text: "", bild: "" };
  }
}

export async function POST(req: Request) {
  const geraet = await geraetAusAnfrage(req);
  if (!geraet) return nichtErlaubt();
  if (!kiBereit()) return Response.json({ fehler: "Die KI ist auf dem Server noch nicht eingerichtet." }, { status: 503 });

  const db = sql();
  const zaehler = (await db.query(
    "SELECT count(*)::int AS n FROM ki_aufrufe WHERE geraet_id = $1 AND zweck = 'teilen' AND zeitpunkt > now() - interval '1 day'",
    [geraet]
  )) as { n: number }[];
  if (zaehler[0].n >= PRO_TAG) return Response.json({ fehler: "Für heute sind genug Vorschläge gemacht – bitte selbst ausfüllen." }, { status: 429 });

  const eingabe = (await req.json().catch(() => ({}))) as { titel?: string; text?: string; url?: string };
  const titel = (eingabe.titel ?? "").slice(0, 300);
  const text = (eingabe.text ?? "").slice(0, 3000);
  let url = (eingabe.url ?? "").trim();
  if (!url) url = text.match(/https?:\/\/\S+/)?.[0] ?? "";
  if (url && !/^https?:\/\//i.test(url)) url = "";

  const seite = url ? await seiteLesen(url) : { text: "", bild: "" };
  if (!titel && !text && !seite.text) return Response.json({ fehler: "Es wurde nichts Lesbares geteilt." }, { status: 400 });

  await db.query("INSERT INTO ki_aufrufe (geraet_id, zweck) VALUES ($1, 'teilen')", [geraet]);
  const heute = wienTag(new Date());
  const prompt = `Jemand hat eine Veranstaltung an die App „Wo is wos los?“ (Kärnten, Slowenien, Friaul) geteilt.
Lies daraus EINE Veranstaltung heraus. Heute ist ${heute}.
Regeln:
- Titel immer auf Deutsch (übersetze slowenische/italienische Titel sinngemäß).
- Datum genau übernehmen. Fehlt das Jahr, nimm das nächste passende Datum ab heute.
- Nichts erfinden: Was nicht dasteht, bleibt leer. Ohne erkennbares Datum: gefunden = false.
- kurzbeschreibung in eigenen Worten, höchstens 2 Sätze.

Geteilter Titel: ${titel || "–"}
Geteilter Text: ${text || "–"}
Link: ${url || "–"}
${seite.text ? `\nInhalt der verlinkten Seite:\n${seite.text}` : ""}`;

  try {
    const v = await kiJson<Vorschlag>(prompt, SCHEMA);
    const datumOk = (d: string) => (/^\d{4}-\d{2}-\d{2}$/.test(d) ? d : "");
    const vorschlag: Vorschlag = {
      gefunden: !!v.gefunden && !!datumOk(v.datum),
      titel: (v.titel || titel).slice(0, 200),
      datum: datumOk(v.datum),
      uhrzeit: /^\d{2}:\d{2}$/.test(v.uhrzeit) ? v.uhrzeit : "",
      datumEnde: datumOk(v.datumEnde),
      ort: (v.ort ?? "").slice(0, 120),
      adresse: (v.adresse ?? "").slice(0, 200),
      kategorie: KATEGORIEN.some((k) => k.id === v.kategorie) ? v.kategorie : "sonstiges",
      kurzbeschreibung: (v.kurzbeschreibung ?? "").slice(0, 500),
      preisText: (v.preisText ?? "").slice(0, 120),
      gratis: v.gratis ?? null,
      freiluft: v.freiluft ?? null,
      bildUrl: /^https:\/\//.test(v.bildUrl) ? v.bildUrl : /^https:\/\//.test(seite.bild) ? seite.bild : "",
    };
    return Response.json({ vorschlag, url });
  } catch (e) {
    console.error(e);
    return Response.json({ fehler: "Die KI ist gerade überlastet – bitte selbst ausfüllen oder später nochmal probieren.", url }, { status: 503 });
  }
}
