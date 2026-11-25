// Kärntner Messen Klagenfurt: Messekalender (einheitliches HTML, keine KI nötig).
import * as cheerio from "cheerio";
import type { Quelle, RohEvent } from "../typen.ts";
import { parseDatumDE, wienZeit } from "../lib/zeit.ts";
import { kategorienAusText, type KategorieId } from "../../lib/kategorien.ts";

const URL_KALENDER = "https://www.kaerntnermessen.at/messekalender/";

export const kaerntnerMessen: Quelle = {
  id: "kaerntner-messen",
  name: "Kärntner Messen Klagenfurt",
  url: URL_KALENDER,
  art: "html",
  land: "AT",
  horizontTage: 365,
  async holen(k) {
    const html = await k.holeText(URL_KALENDER);
    const $ = cheerio.load(html);
    const events: RohEvent[] = [];
    const hinweise: string[] = [];

    $(".fairs-list").each((_, el) => {
      const eintrag = $(el);
      const titel = eintrag.find(".event-list-title").first().text().trim();
      const datumText = eintrag.find("h2 strong").first().text().trim(); // „15.01.2027 - 17.01.2027“
      const beschreibung = eintrag.find(".grid-entry-excerpt").first().text().trim();
      const link = eintrag.find("a.fairs-buttons").attr("href") ?? URL_KALENDER;
      if (!titel || !datumText) return;

      const [vonText, bisText] = datumText.split(/\s*[-–]\s*/);
      const von = parseDatumDE(vonText ?? "");
      const bis = parseDatumDE(bisText ?? vonText ?? "");
      if (!von) {
        hinweise.push(`Datum unlesbar: ${titel} „${datumText}“`);
        return;
      }
      const ende = bis ?? von;

      const kategorien = new Set<KategorieId>(["messen-maerkte", ...kategorienAusText(`${titel} ${beschreibung}`)]);
      if (/frühlingsfest|gaudepark/i.test(titel)) kategorien.delete("messen-maerkte");

      events.push({
        quelleId: "kaerntner-messen",
        url: new URL(link, URL_KALENDER).href,
        urlIstDetail: link !== URL_KALENDER,
        titel,
        beschreibung: beschreibung || undefined,
        beginn: wienZeit(von.jahr, von.monat, von.tag),
        ende: wienZeit(ende.jahr, ende.monat, ende.tag, 23, 59),
        ganztaegig: true,
        ortName: "Messe Klagenfurt",
        adresse: "Messeplatz 1, 9020 Klagenfurt am Wörthersee, Österreich",
        land: "AT",
        region: "Kärnten",
        kategorien: [...kategorien],
        freiluft: /frühlingsfest|gaudepark/i.test(titel) ? true : false,
        sicherheit: "sicher",
      });
    });

    if (!events.length) hinweise.push("Keine Messen gefunden – hat sich die Seite geändert?");
    return { events, hinweise };
  },
};
