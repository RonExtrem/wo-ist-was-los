// meinbezirk.at – Veranstaltungen aller Bundesländer. Liste nach Tagen gefiltert, Details als schema.org-Event (JSON-LD).
// Bekannte Veranstaltungen werden nicht jede Nacht neu abgerufen (spart tausende Abrufe), siehe faelligFuerAbruf().
import type { Quelle, RohEvent, Kontext } from "../typen.ts";
import { db } from "../lib/db.ts";
import {
  kategorienAusText,
  freiluftAusText,
  type KategorieId,
} from "../../lib/kategorien.ts";
import { plusTage, wienTag } from "../lib/zeit.ts";

const BASIS = "https://www.meinbezirk.at";

/** meinbezirk-Kategorie (aus der URL) → unsere Kategorie. null = nicht sammeln. */
const KATEGORIE_MAP: Record<string, KategorieId | null> = {
  "c-ball-fest": "feste-brauchtum",
  "c-brauchtum-kultur": "feste-brauchtum",
  "c-konzert-buehne-kino": "klassik-kultur",
  "c-kulinarik": "kulinarik-wein",
  "c-markt-basar": "messen-maerkte",
  "c-kinder-jugend": "familie-kinder",
  "c-sport": "sport",
  "c-literatur-buch": "klassik-kultur",
  "c-sonstiges": "sonstiges",
  "c-gesundheit": null,
  "c-workshop-seminar-infoveranstaltung": null,
};
const SAMMEL_KATEGORIEN = Object.keys(KATEGORIE_MAP).filter(
  (k) => KATEGORIE_MAP[k],
);

const VOLL = 25; // ab so vielen Treffern ist die Liste vermutlich abgeschnitten

interface Bundesland {
  id: string; // Kennung der Quelle
  slug: string; // Pfad bei meinbezirk
  name: string;
  tage: number; // so viele Tage einzeln abfragen
  wochen: number; // danach so viele Wochen
}

/** Kärnten ganz genau (Papas Heimat), die anderen Bundesländer etwas gröber. */
export const BUNDESLAENDER: Bundesland[] = [
  {
    id: "meinbezirk",
    slug: "kaernten",
    name: "Kärnten",
    tage: Number(process.env.MEINBEZIRK_TAGE ?? 60),
    wochen: Number(process.env.MEINBEZIRK_WOCHEN ?? 30),
  },
  {
    id: "meinbezirk-steiermark",
    slug: "steiermark",
    name: "Steiermark",
    tage: 35,
    wochen: 16,
  },
  {
    id: "meinbezirk-salzburg",
    slug: "salzburg",
    name: "Salzburg",
    tage: 35,
    wochen: 16,
  },
  {
    id: "meinbezirk-tirol",
    slug: "tirol",
    name: "Tirol",
    tage: 35,
    wochen: 16,
  },
  {
    id: "meinbezirk-oberoesterreich",
    slug: "oberoesterreich",
    name: "Oberösterreich",
    tage: 35,
    wochen: 16,
  },
  {
    id: "meinbezirk-niederoesterreich",
    slug: "niederoesterreich",
    name: "Niederösterreich",
    tage: 35,
    wochen: 16,
  },
  { id: "meinbezirk-wien", slug: "wien", name: "Wien", tage: 35, wochen: 16 },
  {
    id: "meinbezirk-burgenland",
    slug: "burgenland",
    name: "Burgenland",
    tage: 35,
    wochen: 16,
  },
  {
    id: "meinbezirk-vorarlberg",
    slug: "vorarlberg",
    name: "Vorarlberg",
    tage: 35,
    wochen: 16,
  },
];

function listenUrl(
  land: Bundesland,
  von: string,
  bis: string,
  kategorie?: string,
): string {
  const pfad = kategorie
    ? `/event/${land.slug}/${kategorie}/list`
    : `/event/${land.slug}/list`;
  const q = new URLSearchParams({
    "eventitem_filter_simple[date_start]": von,
    "eventitem_filter_simple[date_end]": bis,
  });
  return `${BASIS}${pfad}?${q}`;
}

function linksAus(html: string): string[] {
  return [
    ...new Set(
      [...html.matchAll(/href="(\/event\/[^"]+_e\d+)"/g)].map((m) => m[1]),
    ),
  ];
}

async function sammleLinks(
  land: Bundesland,
  k: Kontext,
  hinweise: string[],
): Promise<Set<string>> {
  const links = new Set<string>();
  const heute = new Date();
  const fenster: [string, string][] = [];
  for (let t = 0; t < land.tage; t++) {
    const tag = wienTag(plusTage(heute, t));
    fenster.push([tag, tag]);
  }
  for (let w = 0; w < land.wochen; w++) {
    const von = plusTage(heute, land.tage + w * 7);
    fenster.push([wienTag(von), wienTag(plusTage(von, 6))]);
  }

  for (const [von, bis] of fenster) {
    try {
      const gefunden = linksAus(await k.holeText(listenUrl(land, von, bis)));
      gefunden.forEach((l) => links.add(l));
      if (gefunden.length >= VOLL) {
        // Liste abgeschnitten → pro Kategorie nachfragen
        for (const kat of SAMMEL_KATEGORIEN) {
          linksAus(await k.holeText(listenUrl(land, von, bis, kat))).forEach(
            (l) => links.add(l),
          );
        }
      }
    } catch (err) {
      hinweise.push(`Liste ${von}–${bis}: ${(err as Error).message}`);
    }
  }
  return links;
}

interface LdEvent {
  "@type"?: string;
  name?: string;
  description?: string;
  url?: string;
  startDate?: string;
  endDate?: string;
  image?: string[] | string;
  location?: Array<{
    name?: string;
    address?: {
      streetAddress?: string;
      addressLocality?: string;
      postalCode?: string;
    };
  }>;
}

function ldEvents(html: string): LdEvent[] {
  const out: LdEvent[] = [];
  for (const m of html.matchAll(
    /<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g,
  )) {
    try {
      const daten = JSON.parse(m[1]);
      for (const d of Array.isArray(daten) ? daten : [daten])
        if (d?.["@type"] === "Event") out.push(d);
    } catch {
      /* kaputtes JSON ignorieren */
    }
  }
  return out;
}

/** Termine zusammenfassen: aufeinanderfolgende Tage werden ein Zeitraum. Höchstens 3 künftige Zeiträume. */
function zeitraeume(
  termine: { beginn: Date; ende?: Date }[],
): { beginn: Date; ende?: Date }[] {
  const sortiert = [...termine].sort(
    (a, b) => a.beginn.getTime() - b.beginn.getTime(),
  );
  const ergebnis: { beginn: Date; ende?: Date }[] = [];
  for (const t of sortiert) {
    const letzter = ergebnis[ergebnis.length - 1];
    const letzterTag = letzter ? wienTag(letzter.ende ?? letzter.beginn) : null;
    if (
      letzter &&
      letzterTag &&
      (letzterTag === wienTag(t.beginn) ||
        wienTag(plusTage(new Date(letzterTag + "T12:00:00Z"), 1)) ===
          wienTag(t.beginn))
    ) {
      letzter.ende = t.ende ?? t.beginn;
    } else {
      ergebnis.push({ ...t });
    }
  }
  const jetzt = Date.now();
  return ergebnis
    .filter((z) => (z.ende ?? z.beginn).getTime() >= jetzt)
    .slice(0, 3);
}

/** Kleine Prüfzahl aus der Adresse – verteilt die Wochen-Auffrischung gleichmäßig auf die Tage. */
function pruefzahl(text: string): number {
  let h = 0;
  for (const z of text) h = (h * 31 + z.charCodeAt(0)) >>> 0;
  return h;
}

/**
 * Bekannte Veranstaltungen (schon in der Datenbank) nur neu abrufen, wenn sie bald stattfinden
 * oder ihr Wochentag dran ist. Die übrigen gelten als „heute gesehen“.
 * Liefert die Adressen, die NICHT abgerufen werden müssen.
 */
async function bekannteUeberspringen(
  quelleId: string,
  urls: string[],
  trocken: boolean,
): Promise<Set<string>> {
  if (!urls.length) return new Set();
  const { rows } = await db().query(
    `SELECT l.url, e.id, e.beginn FROM event_links l JOIN events e ON e.id = l.event_id
      WHERE l.quelle_id = $1 AND l.url = ANY($2::text[]) AND e.status IN ('aktiv', 'geaendert')`,
    [quelleId, urls],
  );
  const tagNr = Math.floor(Date.now() / 86_400_000);
  const bald = Date.now() + 10 * 86_400_000;
  const skip = new Set<string>();
  const ids: string[] = [];
  for (const r of rows as { url: string; id: string; beginn: string }[]) {
    const faellig =
      new Date(r.beginn).getTime() < bald || pruefzahl(r.url) % 7 === tagNr % 7;
    if (faellig) continue;
    skip.add(r.url);
    ids.push(r.id);
  }
  if (ids.length && !trocken) {
    await db().query(
      "UPDATE events SET zuletzt_gesehen = now() WHERE id = ANY($1::uuid[])",
      [ids],
    );
  }
  return skip;
}

export function meinbezirkQuelle(land: Bundesland): Quelle {
  return {
    id: land.id,
    name: `meinbezirk.at ${land.name}`,
    url: `${BASIS}/event/${land.slug}/list`,
    art: "jsonld",
    land: "AT",
    horizontTage: land.tage,
    async holen(k) {
      const hinweise: string[] = [];
      const events: RohEvent[] = [];
      const links = await sammleLinks(land, k, hinweise);
      const skip = await bekannteUeberspringen(
        land.id,
        [...links].map((p) => BASIS + p),
        k.trocken ?? false,
      );
      k.log(
        `  meinbezirk ${land.name}: ${links.size} Event-Seiten gefunden, ${skip.size} bekannte diesmal übersprungen`,
      );

      for (const pfad of links) {
        if (skip.has(BASIS + pfad)) continue;
        const katSchluessel = pfad.split("/")[3] ?? "";
        const grundKategorie = KATEGORIE_MAP[katSchluessel];
        if (grundKategorie === null) continue; // Gesundheit, Seminare usw. überspringen

        const url = BASIS + pfad;
        let lds: LdEvent[];
        try {
          lds = ldEvents(await k.holeText(url));
        } catch (err) {
          hinweise.push(`${pfad}: ${(err as Error).message}`);
          continue;
        }
        if (!lds.length) continue;

        const erstes = lds[0];
        const titel = (erstes.name ?? "").trim();
        const ort = erstes.location?.[0];
        const a = ort?.address;
        if (!titel || !ort || !(a?.addressLocality || ort.name)) continue;

        const termine = lds
          .filter((l) => l.startDate)
          .map((l) => ({
            beginn: new Date(l.startDate!),
            ende: l.endDate ? new Date(l.endDate) : undefined,
          }))
          .filter((t) => !Number.isNaN(t.beginn.getTime()));

        const beschreibung =
          (erstes.description ?? "")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 300) || undefined;
        const text = `${titel} ${beschreibung ?? ""}`;
        const kategorien = new Set<KategorieId>(kategorienAusText(text));
        if (
          grundKategorie &&
          !(
            grundKategorie === "klassik-kultur" &&
            (kategorien.has("schlager-volksmusik") ||
              kategorien.has("pop-rock-party"))
          )
        ) {
          kategorien.add(grundKategorie);
        }
        if (kategorien.size > 1) kategorien.delete("sonstiges");
        if (!kategorien.size) kategorien.add("sonstiges");

        const bilder = Array.isArray(erstes.image)
          ? erstes.image
          : erstes.image
            ? [erstes.image]
            : [];
        const bild = bilder.find((b) => !b.includes("logo-open-graph"));
        const adresse = [
          a?.streetAddress,
          [a?.postalCode, a?.addressLocality].filter(Boolean).join(" "),
          "Österreich",
        ]
          .filter((x) => x && String(x).trim())
          .join(", ");

        for (const z of zeitraeume(termine)) {
          const ganztaegig =
            wienTag(z.beginn) !== wienTag(z.ende ?? z.beginn) &&
            z.beginn.getUTCHours() === 23;
          events.push({
            quelleId: land.id,
            url,
            urlIstDetail: true,
            titel,
            beschreibung,
            beginn: z.beginn,
            ende: z.ende,
            ganztaegig,
            ortName: [ort.name, a?.addressLocality]
              .filter(Boolean)
              .filter((v, i, arr) => arr.indexOf(v) === i)
              .join(", "),
            adresse,
            land: "AT",
            region: land.name,
            kategorien: [...kategorien],
            bildUrl: bild,
            freiluft: freiluftAusText(text),
            sicherheit: "sicher",
          });
        }
      }
      return { events, hinweise };
    },
  };
}
