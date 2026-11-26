// Gemeinde-Terminkalender: Viele Kärntner Gemeinden haben dieselbe Webseite (TYPO3 „Geko“, Pfad …/termine).
// Ein Leser für alle – ohne KI. Neue Gemeinde = eine Zeile in GEMEINDEN.
import * as cheerio from "cheerio";
import type { Quelle, RohEvent } from "../typen.ts";
import { parseDatumDE, wienZeit, wienTag } from "../lib/zeit.ts";
import { kategorienAusText, freiluftAusText, type KategorieId } from "../../lib/kategorien.ts";
import { ortSuchen, abstandKm } from "../lib/geo.ts";

interface Gemeinde {
  id: string;
  name: string; // Gemeinde, wie sie für die Ortssuche gebraucht wird
  url: string; // Terminseite
}

/** Oberkärnten + Gailtal + Unteres Drautal. */
export const GEMEINDEN: Gemeinde[] = [
  { id: "bad-kleinkirchheim", name: "Bad Kleinkirchheim", url: "https://bad-kleinkirchheim.gv.at/unser-bad-kleinkirchheim/termine" },
  { id: "flattach", name: "Flattach", url: "https://flattach.gv.at/unser-flattach/termine" },
  { id: "grosskirchheim", name: "Großkirchheim", url: "https://grosskirchheim.gv.at/unsere-gemeinde/termine" },
  { id: "heiligenblut", name: "Heiligenblut am Großglockner", url: "https://heiligenblut.gv.at/unser-heiligenblut/termine" },
  { id: "irschen", name: "Irschen", url: "https://irschen.gv.at/unser-irschen/termine" },
  { id: "krems", name: "Krems in Kärnten", url: "https://krems-kaernten.gv.at/unser-krems/termine" },
  { id: "lurnfeld", name: "Lurnfeld", url: "https://lurnfeld.gv.at/unser-lurnfeld/termine" },
  { id: "malta", name: "Malta", url: "https://malta.gv.at/unser-malta/termine" },
  { id: "oberdrauburg", name: "Oberdrauburg", url: "https://oberdrauburg.at/unser-oberdrauburg/termine" },
  { id: "obervellach", name: "Obervellach", url: "https://obervellach.gv.at/unser-obervellach/termine" },
  { id: "kirchbach", name: "Kirchbach", url: "https://kirchbach.gv.at/unser-kirchbach/termine-veranstaltungen" },
  { id: "gitschtal", name: "Gitschtal", url: "https://gitschtal.gv.at/unser-gitschtal/termine" },
  { id: "lesachtal", name: "Lesachtal", url: "https://lesachtal.gv.at/unser-lesachtal/termine" },
  { id: "st-stefan-gailtal", name: "St. Stefan im Gailtal", url: "https://st-stefan-gailtal.gv.at/unser-st-stefan/termine" },
  { id: "paternion", name: "Paternion", url: "https://paternion.gv.at/unser-paternion/termine" },
];

/** Amtliches, Kurse, Gottesdienste … – das ist nichts für die App. */
const WEGLASSEN =
  /sprechstunde|sprechtag|sprechzeit|sitzung|gemeinderat|ausschuss|müll|abfuhr|altstoff|problemstoff|grünschnitt|mutterberatung|elternberatung|beratung|impf|blutspende|amtstag|parteienverkehr|notar|bauverhandlung|geschlossen|geöffnet|schließtag|öffnungszeit|kehrmaschine|schleifdienst|übung\b|werkstätte|kurs|sachkunde|hundehalter|mobility|rückenwellness|yoga|turnen|gymnastik|pilates|\btraining\b|\bprobe\b|gottesdienst|hl\. messe|heilige messe|rosenkranz|andacht|rorate|maiandacht|vortrag|seminar|workshop|infoveranstaltung|informationsveranstaltung|stammtisch|elternbildung|wahl\b|sperre|straßensperr|ablesung|zählerstand|hundekunde|feuerlöscher|gelber sack|abholaktion|sammlung\b|versammlung|mette\b|(?<!(fach|freizeit|herbst|agrar|hochzeits|bau|gesundheits|job|bildungs|frühjahrs))messe\b|blut\b/i;

/** Kategorie der Gemeinde-Seite → unsere Kategorie (nur wenn der Text nichts Besseres hergibt). */
function kategorieAusGemeinde(kat: string): KategorieId | null {
  const k = kat.toLowerCase();
  if (/sport/.test(k)) return "sport";
  if (/familie|kinder/.test(k)) return "familie-kinder";
  if (/kunst|kultur/.test(k)) return "klassik-kultur";
  return null;
}

const DATUM = /(\d{2}\.\d{2}\.\d{4})(?:\s*(?:um\s*)?(\d{1,2}[:.]\d{2}))?(?:\s*(?:-|–|bis)\s*(\d{2}\.\d{2}\.\d{4})?\s*(\d{1,2}[:.]\d{2})?)?/;
const NICHT_ORT = /^(mehr infos|» ?weiterlesen.*|weiterlesen.*|uhr)$/i;

function zeitpunkt(datum: string, uhrzeit?: string): Date | null {
  const d = parseDatumDE(datum);
  if (!d) return null;
  const u = uhrzeit?.match(/(\d{1,2})[:.](\d{2})/);
  return wienZeit(d.jahr, d.monat, d.tag, u ? Number(u[1]) : 0, u ? Number(u[2]) : 0);
}

export function gemeindeQuelle(g: Gemeinde): Quelle {
  return {
    id: `gemeinde-${g.id}`,
    name: `Gemeinde ${g.name}`,
    url: g.url,
    art: "html",
    land: "AT",
    horizontTage: 45,
    leerOk: true, // kleine Gemeinden haben manchmal wochenlang keine Termine
    async holen(k) {
      const html = await k.holeText(g.url);
      const $ = cheerio.load(html);
      const hinweise: string[] = [];
      const events: RohEvent[] = [];
      const heute = wienTag(new Date());
      const proTitel = new Map<string, number>();

      // Mittelpunkt der Gemeinde: Schutz gegen falsche Treffer bei der Ortssuche
      const mitte = await ortSuchen(`${g.name}, Kärnten, Österreich`);

      const karten = $('a[href*="termine-detail/"]').toArray();
      for (const a of karten) {
        const karte = $(a);
        const href = karte.attr("href") ?? "";
        const titel = (karte.find(".termin-title").first().text() || karte.find("[data-title]").attr("data-title") || "")
          .replace(/\s+/g, " ")
          .trim();
        if (!titel) continue;
        const gemeindeKat = karte.find("[data-category]").attr("data-category") ?? karte.parent().attr("data-category") ?? "";
        if (WEGLASSEN.test(titel)) continue;

        // Text der Karte in Stücken: Titel, (Anriss), Datum/Uhrzeit, Ort, „Mehr Infos“
        karte.find("br").replaceWith("\n");
        karte.find("h3, p, div, strong, span").each((_, el) => {
          $(el).append("\n");
        });
        const teile = karte
          .text()
          .split("\n")
          .map((t) => t.replace(/\s+/g, " ").trim())
          .filter(Boolean);
        const iDatum = teile.findIndex((t) => DATUM.test(t));
        if (iDatum < 0) {
          hinweise.push(`${g.name}: kein Datum bei „${titel}“`);
          continue;
        }
        const m = teile[iDatum].match(DATUM)!;
        const beginn = zeitpunkt(m[1], m[2]);
        if (!beginn) continue;
        const endTag = m[3] ?? (m[4] ? m[1] : undefined);
        let ende = endTag ? zeitpunkt(endTag, m[4] ?? (m[2] ? undefined : "23:59")) ?? undefined : undefined;
        if (ende && ende < beginn) ende = undefined;
        if (wienTag(ende ?? beginn) < heute) continue;

        // Gleiche Veranstaltung jede Woche (z. B. Eislaufen) → höchstens 3 Termine
        const schluessel = titel.toLowerCase();
        const n = (proTitel.get(schluessel) ?? 0) + 1;
        proTitel.set(schluessel, n);
        if (n > 3) continue;

        const ortText = teile.slice(iDatum + 1).find((t) => !NICHT_ORT.test(t) && !DATUM.test(t)) ?? "";
        const anriss = teile
          .slice(0, iDatum)
          .filter((t) => t !== titel && !/^\d{1,2}$/.test(t) && !/^[A-ZÄÖÜ][a-zäöü]{2,4}\.?$/.test(t) && !NICHT_ORT.test(t))
          .join(" ")
          .slice(0, 300);

        const text = `${titel} ${anriss}`;
        const kategorien = new Set<KategorieId>(kategorienAusText(text));
        if (!kategorien.size) {
          const k2 = kategorieAusGemeinde(gemeindeKat);
          kategorien.add(k2 ?? "sonstiges");
        }

        const ortName = ortText && !ortText.toLowerCase().includes(g.name.toLowerCase()) ? `${ortText}, ${g.name}` : ortText || g.name;
        const adresse = `${ortName}, Österreich`;
        let punkt = mitte ? { lat: mitte.lat, lng: mitte.lng } : undefined;
        if (ortText && mitte) {
          const genau = await ortSuchen(adresse);
          if (genau && abstandKm(genau, mitte) <= 15) punkt = { lat: genau.lat, lng: genau.lng };
        }

        events.push({
          quelleId: `gemeinde-${g.id}`,
          url: new URL(href, g.url).href,
          urlIstDetail: true,
          titel,
          beschreibung: anriss || undefined,
          originalsprache: "de",
          beginn,
          ende,
          ganztaegig: !m[2],
          ortName,
          adresse,
          land: "AT",
          region: "Kärnten",
          lat: punkt?.lat,
          lng: punkt?.lng,
          kategorien: [...kategorien],
          freiluft: freiluftAusText(`${text} ${ortText}`),
          sicherheit: "sicher",
        });
      }
      if (!karten.length) hinweise.push(`${g.name}: keine Termine auf der Seite`);
      return { events, hinweise };
    },
  };
}
