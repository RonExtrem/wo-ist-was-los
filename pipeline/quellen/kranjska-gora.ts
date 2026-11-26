// Kranjska Gora (Kronau): Die Liste der Veranstaltungen kommt aus der öffentlichen WordPress-Schnittstelle,
// Datum und Ort stehen auf jeder (deutschen) Detailseite als schema.org-Event. Ohne KI.
// robots.txt erlaubt das Abrufen ausdrücklich. Sortiert nach „geändert“, weil jährliche Feste alte Beiträge mit neuem Datum sind.
import * as cheerio from "cheerio";
import type { Quelle, RohEvent } from "../typen.ts";
import { wienZeit, wienTag } from "../lib/zeit.ts";
import { kategorienAusText, freiluftAusText, type KategorieId } from "../../lib/kategorien.ts";

const BASIS = "https://kranjska-gora.si";
const LISTE = `${BASIS}/wp-json/wp/v2/dogodki?lang=de&per_page=80&orderby=modified&_fields=id,link,title,excerpt,class_list,modified`;

/** Kategorie der Seite (class_list „kategorije-dogodkov-…“) → unsere Kategorie. */
function kategorieAusSeite(klassen: string[]): KategorieId | null {
  const k = klassen.join(" ");
  if (/musik|glasba|koncert/.test(k)) return "schlager-volksmusik";
  if (/sport|sport/.test(k)) return "sport";
  if (/tradition|tradicij|kulinar/.test(k)) return "feste-brauchtum";
  if (/kultur/.test(k)) return "klassik-kultur";
  if (/kinder|otrok|druzin|famil/.test(k)) return "familie-kinder";
  return null;
}

/** Weglassen: Kurse, Vorträge, Führungen, Meetings … */
const WEGLASSEN = /workshop|vortrag|kurs\b|kurse\b|führung|seminar|tagung|meeting|konferenz|gottesdienst|messe\b(?!.*markt)/i;

/** „12/11/2026T21:00“ (Monat/Tag/Jahr) oder „2026-12-11T21:00“ → Datum. */
function ldZeit(s: string | undefined): { datum: Date; mitUhrzeit: boolean } | null {
  if (!s) return null;
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:T(\d{1,2}):(\d{2}))?/);
  if (m) {
    return {
      datum: wienZeit(Number(m[3]), Number(m[1]), Number(m[2]), m[4] ? Number(m[4]) : 0, m[5] ? Number(m[5]) : 0),
      mitUhrzeit: !!m[4],
    };
  }
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{1,2}):(\d{2}))?/);
  if (m) {
    return {
      datum: wienZeit(Number(m[1]), Number(m[2]), Number(m[3]), m[4] ? Number(m[4]) : 0, m[5] ? Number(m[5]) : 0),
      mitUhrzeit: !!m[4],
    };
  }
  return null;
}

interface LdEvent {
  "@type"?: string;
  name?: string;
  startDate?: string;
  endDate?: string;
  description?: string;
  image?: string[] | string;
  location?: { name?: string; address?: { streetAddress?: string } };
}

function ldEventAus(html: string): LdEvent | null {
  const $ = cheerio.load(html);
  for (const el of $('script[type="application/ld+json"]').toArray()) {
    try {
      const d = JSON.parse($(el).text()) as LdEvent;
      if (d["@type"] === "Event") return d;
    } catch {
      // Manchmal ist das JSON kaputt (z. B. Zeilenumbrüche in der Beschreibung) → wichtigste Felder einzeln lesen
      const roh = $(el).text();
      if (!/"@type"\s*:\s*"Event"/.test(roh)) continue;
      const feld = (n: string) => roh.match(new RegExp(`"${n}"\\s*:\\s*"([^"]*)"`))?.[1];
      return {
        "@type": "Event",
        name: feld("name"),
        startDate: feld("startDate"),
        endDate: feld("endDate"),
        image: feld("image"),
        location: { name: roh.match(/"location"[\s\S]*?"name"\s*:\s*"([^"]*)"/)?.[1] },
      };
    }
  }
  return null;
}

const entities = (s: string) => cheerio.load(`<div>${s}</div>`)("div").text().replace(/\s+/g, " ").trim();

export const kranjskaGora: Quelle = {
  id: "kranjska-gora",
  name: "Kranjska Gora – Veranstaltungen",
  url: `${BASIS}/de/veranstaltungen`,
  art: "jsonld",
  land: "SI",
  horizontTage: 0, // Liste ist nach Veröffentlichung sortiert, nicht nach Datum → keine „verschwunden“-Erkennung
  async holen(k) {
    const hinweise: string[] = [];
    const events: RohEvent[] = [];
    const heute = wienTag(new Date());
    const liste = JSON.parse(await k.holeText(LISTE)) as {
      link: string;
      title: { rendered: string };
      excerpt?: { rendered: string };
      class_list?: string[];
    }[];

    for (const p of liste) {
      const titelListe = entities(p.title.rendered);
      if (WEGLASSEN.test(titelListe)) continue;
      // Deutsche Detailseite (die Schnittstelle liefert sie schon in „link“, sonst /de/veranstaltungen/…)
      const url = p.link.includes("/de/") ? p.link : p.link.replace(/\/dogodki\//, "/de/veranstaltungen/");
      let ld: LdEvent | null;
      try {
        ld = ldEventAus(await k.holeText(url));
      } catch (err) {
        hinweise.push(`${titelListe}: ${(err as Error).message}`);
        continue;
      }
      const start = ldZeit(ld?.startDate);
      if (!ld || !start) {
        hinweise.push(`${titelListe}: kein Datum`);
        continue;
      }
      let ende = ldZeit(ld.endDate)?.datum;
      // „T23:59“ ohne Datum → Ende am selben Tag
      if (!ende && ld.endDate?.match(/^T(\d{1,2}):(\d{2})/)) {
        const [, h, min] = ld.endDate.match(/^T(\d{1,2}):(\d{2})/)!;
        const t = wienTag(start.datum).split("-").map(Number);
        ende = wienZeit(t[0], t[1], t[2], Number(h), Number(min));
      }
      if (ende && ende < start.datum) ende = undefined;
      if (wienTag(ende ?? start.datum) < heute) continue;

      const titel = entities(ld.name ?? titelListe);
      const beschreibung = entities(ld.description ?? p.excerpt?.rendered ?? "").slice(0, 300) || undefined;
      const text = `${titel} ${beschreibung ?? ""}`;
      const kategorien = new Set<KategorieId>(kategorienAusText(text));
      if (!kategorien.size) kategorien.add(kategorieAusSeite(p.class_list ?? []) ?? "sonstiges");
      // „Konzert: …“ ist hier meist Unterhaltungsmusik, keine Klassik
      if (kategorien.has("klassik-kultur") && !/chor|klassik|orchester|oper|theater|kabarett/i.test(text)) {
        if (/\bband\b|tribute|\bdj\b/i.test(text)) {
          kategorien.delete("klassik-kultur");
          kategorien.add("pop-rock-party");
        } else if (/ensemble|quartett|trio\b|musikanten|oberkrainer|narodno/i.test(text)) {
          kategorien.delete("klassik-kultur");
          kategorien.add("schlager-volksmusik");
        }
      }

      // Ortsteile von Kranjska Gora; sonst der Ort selbst
      const platz = ld.location?.name?.trim();
      const ortsteil = text.match(/\b(Podkoren|Rateče|Planica|Gozd Martuljek|Mojstrana|Dovje|Belca|Srednji Vrh)\b/)?.[1];
      const gemeinde = ortsteil ?? "Kranjska Gora";
      const ortName = platz && !platz.includes(gemeinde) ? `${platz}, ${gemeinde}` : (platz ?? gemeinde);
      const bild = Array.isArray(ld.image) ? ld.image[0] : ld.image;

      events.push({
        quelleId: "kranjska-gora",
        url,
        urlIstDetail: true,
        titel,
        beschreibung,
        originalsprache: "sl",
        beginn: start.datum,
        ende,
        ganztaegig: !start.mitUhrzeit,
        ortName,
        adresse: `${gemeinde}, Slowenien`,
        land: "SI",
        region: "Oberkrain",
        kategorien: [...kategorien],
        bildUrl: bild || undefined,
        freiluft: freiluftAusText(text),
        sicherheit: "sicher",
      });
    }
    return { events, hinweise };
  },
};
