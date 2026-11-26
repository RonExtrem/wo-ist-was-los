// Südtirol: offizielle, offene Schnittstelle „Open Data Hub“ (Veranstaltungen von IDM/LTS, Lizenz CC0).
// Deutsch, mit Koordinaten und Gemeinde – ohne KI. https://tourism.api.opendatahub.com
import * as cheerio from "cheerio";
import type { Quelle, RohEvent } from "../typen.ts";
import { wienZeit, wienTag, plusTage } from "../lib/zeit.ts";
import { kategorienAusText, freiluftAusText, type KategorieId } from "../../lib/kategorien.ts";

const API = "https://tourism.api.opendatahub.com/v1/Event";
const TAGE = 120;
const SEITE = 500;

/** Nichts für die App: Kurse, Fachtagungen, Führungen, Gottesdienste … */
const WEGLASSEN =
  /kurs\b|kurse\b|workshop|seminar|tagung|fortbildung|vortrag|webinar|führung|fuehrung|besichtigung|gottesdienst|hl\. messe|heilige messe|rorate|andacht|rosenkranz|sprechstunde|yoga|pilates|gymnastik|training\b|probe\b|sitzung|versammlung|kongress|konferenz|meeting|sprachkurs|nähkurs|kochkurs|symposium|austausch|infoabend|informationsabend|sprechtag|beratung/i;

interface OdhDatum {
  From: string; // "2026-12-04T00:00:00"
  To: string;
  Begin?: string; // "09:00:00"
  End?: string;
  Cancelled?: string;
}
interface OdhEvent {
  Id: string;
  Source?: string;
  Active?: boolean;
  Detail?: Record<string, { Title?: string; BaseText?: string; IntroText?: string }>;
  Latitude?: number;
  Longitude?: number;
  EventDate?: OdhDatum[];
  EventUrls?: { Url?: Record<string, string> }[];
  ImageGallery?: { ImageUrl?: string }[];
  LocationInfo?: {
    MunicipalityInfo?: { Name?: Record<string, string> };
    DistrictInfo?: { Name?: Record<string, string> };
  };
}

function zeit(tag: string, uhr?: string): Date | null {
  const d = tag.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!d) return null;
  const u = uhr?.match(/^(\d{1,2}):(\d{2})/);
  return wienZeit(Number(d[1]), Number(d[2]), Number(d[3]), u ? Number(u[1]) : 0, u ? Number(u[2]) : 0);
}

const nurText = (html: string) => cheerio.load(`<div>${html}</div>`)("div").text().replace(/\s+/g, " ").trim();

export const suedtirol: Quelle = {
  id: "suedtirol",
  name: "Südtirol – Open Data Hub",
  url: "https://mysuedtirol.info/de/veranstaltungen",
  art: "api",
  land: "IT",
  horizontTage: 60,
  async holen(k) {
    const hinweise: string[] = [];
    const events: RohEvent[] = [];
    const heute = new Date();
    const heuteTag = wienTag(heute);
    const bisTag = wienTag(plusTage(heute, TAGE));

    const alle: OdhEvent[] = [];
    for (let seite = 1; seite <= 20; seite++) {
      const url = `${API}?pagenumber=${seite}&pagesize=${SEITE}&begindate=${heuteTag}&enddate=${bisTag}&language=de&active=true&removenullvalues=true`;
      const d = JSON.parse(await k.holeText(url)) as { Items?: OdhEvent[]; TotalPages?: number };
      alle.push(...(d.Items ?? []));
      if (!d.TotalPages || seite >= d.TotalPages) break;
    }
    k.log(`  Open Data Hub: ${alle.length} Einträge`);

    for (const e of alle) {
      if (e.Source && e.Source.toLowerCase() !== "lts") continue; // nur touristische Veranstaltungen
      const de = e.Detail?.de;
      const titel = de?.Title?.replace(/\s+/g, " ").trim();
      if (!titel || WEGLASSEN.test(titel)) continue;
      if (e.Latitude == null || e.Longitude == null) continue;

      const beschreibung = nurText(de?.IntroText || de?.BaseText || "").slice(0, 280) || undefined;
      const text = `${titel} ${beschreibung ?? ""}`;
      const kategorien = new Set<KategorieId>(kategorienAusText(text));
      if (!kategorien.size) kategorien.add("sonstiges");

      const gemeinde = e.LocationInfo?.MunicipalityInfo?.Name?.de;
      const ortsteil = e.LocationInfo?.DistrictInfo?.Name?.de;
      const ortName = [ortsteil && ortsteil !== gemeinde ? ortsteil : null, gemeinde ?? "Südtirol"].filter(Boolean).join(", ");
      const link = e.EventUrls?.map((u) => u.Url?.de ?? Object.values(u.Url ?? {})[0]).find(Boolean);
      const url = link ?? `https://mysuedtirol.info/de/veranstaltungen?eventid=${e.Id}`;
      const bild = e.ImageGallery?.find((b) => b.ImageUrl)?.ImageUrl;

      // Termine: höchstens 3 künftige, abgesagte weglassen
      const kuenftig = (e.EventDate ?? []).filter((t) => t.Cancelled !== "1" && t.To.slice(0, 10) >= heuteTag);
      // Dauerangebote (z. B. Bogenschießen, Rodeln, Führungen an vielen Tagen) sind keine Veranstaltungen –
      // außer Märkte, Feste und Adventliches, die auch an vielen Tagen stattfinden.
      const besonders = ["advent", "feste-brauchtum", "messen-maerkte", "schlager-volksmusik", "kulinarik-wein"].some((x) =>
        kategorien.has(x as KategorieId)
      );
      if (kuenftig.length > 6 && !besonders) continue;
      const termine = kuenftig
        .filter((t) => t.Cancelled !== "1")
        .map((t) => {
          const ganztaegig = (!t.Begin || t.Begin.startsWith("00:00")) && (!t.End || t.End.startsWith("23:59"));
          const beginn = zeit(t.From, ganztaegig ? undefined : t.Begin);
          let ende = zeit(t.To, t.End ?? "23:59") ?? undefined;
          if (beginn && ende && ende <= beginn) ende = undefined;
          return beginn ? { beginn, ende, ganztaegig } : null;
        })
        .filter((t): t is { beginn: Date; ende: Date | undefined; ganztaegig: boolean } => !!t && wienTag(t.ende ?? t.beginn) >= heuteTag)
        .sort((a, b) => a.beginn.getTime() - b.beginn.getTime())
        .slice(0, 3);

      for (const t of termine) {
        events.push({
          quelleId: "suedtirol",
          url,
          urlIstDetail: true,
          titel,
          beschreibung,
          originalsprache: "de",
          beginn: t.beginn,
          ende: t.ende,
          ganztaegig: t.ganztaegig,
          ortName,
          adresse: `${gemeinde ?? ""}, Südtirol, Italien`,
          land: "IT",
          region: "Südtirol",
          lat: e.Latitude,
          lng: e.Longitude,
          kategorien: [...kategorien],
          bildUrl: bild,
          freiluft: freiluftAusText(text),
          sicherheit: "sicher",
        });
      }
    }
    if (!events.length) hinweise.push("Keine Termine – Schnittstelle prüfen");
    return { events, hinweise };
  },
};
