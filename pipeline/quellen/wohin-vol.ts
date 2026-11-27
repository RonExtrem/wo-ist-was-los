// WOHIN (wohin.vol.at) – Veranstaltungsplattform der Vorarlberger Nachrichten. Auf meinbezirk gibt es Vorarlberg praktisch nicht.
// Alle Veranstaltungen stehen in der Sitemap, jede Detailseite hat ein schema.org-Event (JSON-LD). robots.txt erlaubt /event/.
// Bekannte Veranstaltungen werden wie bei meinbezirk nicht jede Nacht neu abgerufen.
import type { Quelle, RohEvent } from "../typen.ts";
import { kategorienAusText, freiluftAusText, type KategorieId } from "../../lib/kategorien.ts";
import { istWienMitternacht, ldZeit, wienTag } from "../lib/zeit.ts";
import { bekannteUeberspringen, bundeslandAusPlz } from "./meinbezirk.ts";
import { nichtSammeln } from "../lib/aussortieren.ts";

const BASIS = "https://wohin.vol.at";
const ID = "wohin-vorarlberg";

interface LdEvent {
  "@type"?: string;
  name?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  eventStatus?: string;
  image?: string[] | string;
  location?: {
    name?: string;
    address?: { streetAddress?: string; addressLocality?: string; postalCode?: string; addressCountry?: string };
  };
}

function ldEvent(html: string): LdEvent | null {
  for (const m of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g)) {
    try {
      const d = JSON.parse(m[1]);
      for (const x of Array.isArray(d) ? d : [d]) if (x?.["@type"] === "Event") return x as LdEvent;
    } catch {
      /* kaputtes JSON ignorieren */
    }
  }
  return null;
}

export const wohinVorarlberg: Quelle = {
  id: ID,
  name: "WOHIN (VOL.AT) Vorarlberg",
  url: `${BASIS}/search/vorarlberg`,
  art: "jsonld",
  land: "AT",
  horizontTage: 120,
  async holen(k) {
    const hinweise: string[] = [];
    const events: RohEvent[] = [];
    const sitemap = await k.holeText(`${BASIS}/sitemap.xml`);
    const urls = [
      ...new Set([...sitemap.matchAll(/<loc>(https:\/\/wohin\.vol\.at\/event\/[^<\s]+)<\/loc>/g)].map((m) => m[1].trim())),
    ];
    const skip = await bekannteUeberspringen(ID, urls, k.trocken ?? false);
    k.log(`  WOHIN: ${urls.length} Event-Seiten in der Sitemap, ${skip.size} bekannte diesmal übersprungen`);
    const jetzt = Date.now();
    let vorbei = 0;
    let aussortiert = 0;

    // Zum Testen begrenzbar (WOHIN_MAX=50), sonst alle
    const max = Number(process.env.WOHIN_MAX ?? Infinity);
    let abgerufen = 0;
    for (const url of urls) {
      if (skip.has(url)) continue;
      if (++abgerufen > max) break;
      try {
        const ev = ldEvent(await k.holeText(url));
        if (!ev) continue;
        const titel = (ev.name ?? "").replace(/\s+/g, " ").trim();
        if (!titel || /^abgesagt\b/i.test(titel) || /Cancelled|Postponed/i.test(ev.eventStatus ?? "")) continue;

        const b = ldZeit(ev.startDate);
        if (!b) continue;
        const e = ldZeit(ev.endDate, true);
        let ende = e && e.zeit > b.zeit ? e.zeit : undefined;
        // Nur-Datum als Ende am selben Tag = „endet an diesem Tag“
        if (ende && e?.nurDatum && wienTag(ende) === wienTag(b.zeit)) ende = undefined;
        if ((ende ?? b.zeit).getTime() < jetzt - 3 * 3600_000) {
          vorbei++;
          continue;
        }

        const beschreibung = (ev.description ?? "").replace(/\s+/g, " ").trim().slice(0, 300) || undefined;
        const text = `${titel} ${beschreibung ?? ""}`;
        if (nichtSammeln(titel)) {
          aussortiert++;
          continue;
        }

        const a = ev.location?.address;
        const strasse = (a?.streetAddress ?? "").trim();
        // Postleitzahl steckt oft in der Straße („Kapf 1, 6835 Zwischenwasser“). 5-stellig = Deutschland/Schweiz-Umland → weglassen
        if (/\b\d{5}\b/.test(strasse) || (a?.postalCode && /^\d{5}$/.test(a.postalCode.trim()))) continue;
        const plz = a?.postalCode?.trim() || strasse.match(/\b(\d{4})\s+\p{L}/u)?.[1];
        const ortLocality = (a?.addressLocality ?? "").trim();
        const ortName = [ev.location?.name?.trim(), ortLocality]
          .filter((v): v is string => !!v)
          .filter((v, i, arr) => arr.indexOf(v) === i)
          .join(", ");
        if (!ortName) continue;
        const adresse = [strasse || undefined, ortLocality && !strasse.includes(ortLocality) ? ortLocality : undefined, "Österreich"]
          .filter(Boolean)
          .join(", ");

        const kategorien = new Set<KategorieId>(kategorienAusText(text));
        if (kategorien.size > 1) kategorien.delete("sonstiges");
        if (!kategorien.size) kategorien.add("sonstiges");
        const bilder = Array.isArray(ev.image) ? ev.image : ev.image ? [ev.image] : [];

        const ganztaegig = b.nurDatum || (!!ende && wienTag(ende) !== wienTag(b.zeit) && istWienMitternacht(b.zeit));
        events.push({
          quelleId: ID,
          url,
          urlIstDetail: true,
          titel,
          beschreibung,
          beginn: b.zeit,
          ende,
          ganztaegig,
          ortName,
          adresse,
          land: "AT",
          // Ohne eindeutige PLZ entscheidet die Ortssuche (z. B. St. Anton am Arlberg → Tirol)
          region: bundeslandAusPlz(plz) ?? undefined,
          // Deutsche/Schweizer Orte (Lindau, Konstanz, St. Gallen …) nicht auf gleichnamige Orte in Österreich legen
          erlaubteRegionen: ["Vorarlberg", "Tirol"],
          kategorien: [...kategorien],
          bildUrl: bilder[0],
          freiluft: freiluftAusText(text),
          sicherheit: "sicher",
        });
      } catch (err) {
        hinweise.push(`${url}: übersprungen (${(err as Error).message})`);
      }
    }
    k.log(`  WOHIN: ${vorbei} schon vorbei, ${aussortiert} Kurse/Beratung u. ä. weggelassen`);
    return { events, hinweise };
  },
};
