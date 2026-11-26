// dolomiti.it (deutsche Seite): Höhepunkte in Südtirol, Belluno/Cortina und Friaul – schema.org-Events direkt in der Liste.
// Ohne KI. Orte außerhalb des Suchgebiets (z. B. Trentino) fallen beim Speichern automatisch weg.
import type { Quelle, RohEvent } from "../typen.ts";
import { wienTag, wienZeit } from "../lib/zeit.ts";
import { kategorienAusText, freiluftAusText, type KategorieId } from "../../lib/kategorien.ts";

const BASIS = "https://www.dolomiti.it/de/veranstaltungen";
const MAX_SEITEN = 15;

interface LdEvent {
  "@type"?: string;
  name?: string;
  url?: string;
  startDate?: string;
  endDate?: string;
  description?: string;
  image?: { url?: string } | string;
  eventStatus?: string;
  location?: { name?: string; address?: { addressLocality?: string; addressRegion?: string } };
}

function ldEvents(html: string): LdEvent[] {
  const out: LdEvent[] = [];
  for (const m of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g)) {
    try {
      const d = JSON.parse(m[1]);
      for (const x of Array.isArray(d) ? d : [d]) if (x?.["@type"] === "Event") out.push(x);
    } catch {
      /* kaputtes JSON überspringen */
    }
  }
  return out;
}

/** Zeitpunkt als Ortszeit; Mitternacht = nur Datum (ganztägig). */
function ortszeit(iso: string): { datum: Date; nurTag: boolean } | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const teile = new Intl.DateTimeFormat("de-AT", { timeZone: "Europe/Vienna", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
  return { datum: d, nurTag: teile === "00:00" };
}

export const dolomiti: Quelle = {
  id: "dolomiti",
  name: "dolomiti.it – Veranstaltungen",
  url: BASIS,
  art: "jsonld",
  land: "IT",
  horizontTage: 0, // nur eine Auswahl von Höhepunkten → keine „verschwunden“-Erkennung
  async holen(k) {
    const hinweise: string[] = [];
    const events: RohEvent[] = [];
    const heute = wienTag(new Date());
    const gesehen = new Set<string>();

    for (let seite = 1; seite <= MAX_SEITEN; seite++) {
      const html = await k.holeText(seite === 1 ? BASIS : `${BASIS}?page=${seite}`);
      const lds = ldEvents(html);
      if (!lds.length) break;
      for (const e of lds) {
        const titel = e.name?.replace(/\s+/g, " ").trim();
        const ort = e.location?.address?.addressLocality?.trim() || e.location?.name?.trim();
        if (!titel || !ort || !e.startDate || !e.url || gesehen.has(e.url)) continue;
        gesehen.add(e.url);
        if (e.eventStatus?.includes("Cancelled")) continue;
        const start = ortszeit(e.startDate);
        if (!start) continue;
        const endeRoh = e.endDate ? ortszeit(e.endDate) : null;
        let ende: Date | undefined;
        if (endeRoh) {
          const [j, mo, t] = wienTag(endeRoh.datum).split("-").map(Number);
          ende = endeRoh.nurTag ? wienZeit(j, mo, t, 23, 59) : endeRoh.datum;
        }
        if (ende && ende < start.datum) ende = undefined;
        if (wienTag(ende ?? start.datum) < heute) continue;

        const beschreibung = e.description?.replace(/\s+/g, " ").replace(/\.\.\.$/, " …").trim().slice(0, 280) || undefined;
        const text = `${titel} ${beschreibung ?? ""}`;
        const kategorien = new Set<KategorieId>(kategorienAusText(text));
        if (!kategorien.size) kategorien.add("sonstiges");
        const bild = typeof e.image === "string" ? e.image : e.image?.url;

        events.push({
          quelleId: "dolomiti",
          url: e.url,
          urlIstDetail: true,
          titel,
          beschreibung,
          originalsprache: "de",
          beginn: start.datum,
          ende,
          ganztaegig: start.nurTag,
          ortName: ort,
          adresse: `${ort}, Italien`,
          land: "IT",
          region: undefined,
          kategorien: [...kategorien],
          bildUrl: bild,
          freiluft: freiluftAusText(text),
          sicherheit: "sicher",
        });
      }
    }
    if (!events.length) hinweise.push("Keine Termine gefunden – Seitenaufbau prüfen");
    return { events, hinweise };
  },
};
