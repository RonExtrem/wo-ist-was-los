// Seiten ohne maschinenlesbare Daten: Die KI liest den Text und liefert die Events auf Deutsch.
// Unveränderte Seiten werden nicht erneut an die KI geschickt (ki_cache).
import { createHash } from "node:crypto";
import type { Quelle, RohEvent } from "../typen.ts";
import { KATEGORIEN, kategorienAusText, type KategorieId } from "../../lib/kategorien.ts";
import { kiJson, kiVerfuegbar } from "../lib/gemini.ts";
import { seitenText } from "../lib/seitentext.ts";
import { wienZeit, wienTag } from "../lib/zeit.ts";
import { db } from "../lib/db.ts";

export interface KiSeite {
  id: string;
  name: string;
  url: string;
  land: "AT" | "SI" | "IT";
  region: string;
  /** Hinweis an die KI, z. B. Standardort, wenn die Seite ihn nicht bei jedem Event nennt. */
  hinweis?: string;
  /** Weitere Seiten derselben Liste (Blättern), werden zusammen mit der ersten an die KI gegeben. */
  weitereSeiten?: string[];
}

/** Liste der Seiten. Neue Seiten einfach hier ergänzen. */
export const KI_SEITEN: KiSeite[] = [
  { id: "ki-woerthersee-advent", name: "Wörthersee Advent", url: "https://www.woerthersee.com/advent/velden", land: "AT", region: "Kärnten", hinweis: "Adventmärkte rund um den Wörthersee (Velden, Pörtschach, Klagenfurt, Krumpendorf, Maria Wörth)." },
  { id: "ki-weissensee-eis", name: "Weissensee – Eisschnelllauf / Elf-Städte-Tour", url: "https://www.weissensee.com/de/Winter-World/Ice-World/Eisschnelllauf", land: "AT", region: "Kärnten", hinweis: "Ort ist der Weissensee (Techendorf), Kärnten." },
  { id: "ki-villacher-fasching", name: "Villacher Fasching", url: "https://villacher-fasching.at/", land: "AT", region: "Kärnten", hinweis: "Faschingssitzungen finden im Congress Center Villach statt, sofern nicht anders angegeben." },
  { id: "ki-villacher-kirchtag", name: "Villacher Kirchtag (visitvillach.at)", url: "https://www.visitvillach.at/de/villacher-kirchtag.html", land: "AT", region: "Kärnten", hinweis: "Der Villacher Kirchtag findet in der Villacher Altstadt statt." },
  { id: "ki-starnacht", name: "Starnacht am Wörthersee", url: "https://www.starnacht.tv/", land: "AT", region: "Kärnten", hinweis: "Schlager-Großveranstaltung. Nur Termine am Wörthersee (Klagenfurt) übernehmen, keine anderen Starnacht-Orte." },
  { id: "ki-kaernten-events", name: "Kärnten Event GmbH", url: "https://www.kaernten-events.at/", land: "AT", region: "Kärnten" },
  { id: "ki-tarvis", name: "Tarvisiano – Veranstaltungskalender", url: "https://www.tarvisiano.org/it/Info-Service/Eventi/Calendario-manifestazioni", land: "IT", region: "Friaul-Julisch Venetien", hinweis: "Orte im Tarviser Becken (Tarvis/Tarvisio, Malborghetto, Pontebba, Sella Nevea, Camporosso, Fusine).", weitereSeiten: ["https://www.tarvisiano.org/it/Info-Service/Eventi/Calendario-manifestazioni?page=2", "https://www.tarvisiano.org/it/Info-Service/Eventi/Calendario-manifestazioni?page=3"] },
  { id: "ki-villacherkirchtag", name: "Villacher Kirchtag (offizielle Seite)", url: "https://www.villacherkirchtag.at/", land: "AT", region: "Kärnten", hinweis: "Der Villacher Kirchtag findet in der Villacher Altstadt statt." },
  { id: "ki-klagenfurt-christkindlmarkt", name: "Visit Klagenfurt – Christkindlmarkt", url: "https://www.visitklagenfurt.at/de/essen-und-trinken/maerkte/christkindlmarkt-am-neuen-platz/", land: "AT", region: "Kärnten", hinweis: "Christkindlmarkt und Silvestermarkt am Neuen Platz in Klagenfurt am Wörthersee." },
  // Oberkärnten: Gemeinden mit eigener Terminliste (andere Gemeinden siehe gemeinde-kalender.ts)
  { id: "ki-millstatt", name: "Millstatt am See – Veranstaltungen", url: "https://millstatt.at/events/", land: "AT", region: "Kärnten", hinweis: "Orte in der Gemeinde Millstatt am See (Millstatt, Obermillstatt, Dellach, Matzelsdorf). Ohne Ortsangabe: Millstatt am See." },
  { id: "ki-hermagor", name: "Hermagor – Veranstaltungskalender", url: "https://hermagor.at/freizeit-tourismus/veranstaltungskalender/", land: "AT", region: "Kärnten", hinweis: "Stadtgemeinde Hermagor-Pressegger See im Gailtal. Ohne Ortsangabe: Hermagor." },
  { id: "ki-sachsenburg", name: "Sachsenburg – Termine & Veranstaltungen", url: "https://www.sachsenburg.at/de/marktgemeinde/termine-und-veranstaltungen", land: "AT", region: "Kärnten", hinweis: "Marktgemeinde Sachsenburg im Drautal. Ohne Ortsangabe: Sachsenburg." },
  { id: "ki-lendorf", name: "Lendorf – Veranstaltungen", url: "https://www.lendorf.at/veranstaltungen/", land: "AT", region: "Kärnten", hinweis: "Gemeinde Lendorf bei Spittal an der Drau. Ohne Ortsangabe: Lendorf." },
  // Slowenien (Kranjska Gora siehe kranjska-gora.ts)
  { id: "ki-bled", name: "Bled – Veranstaltungen", url: "https://www.bled.si/de/veranstaltungen/", land: "SI", region: "Oberkrain", hinweis: "Veranstaltungen in Bled und Umgebung (Oberkrain, Slowenien). Ohne Ortsangabe: Bled." },
  { id: "ki-koroska-si", name: "Koroška – Slowenisch-Kärnten", url: "https://koroska.si/dogodki/", land: "SI", region: "Slowenisch-Kärnten", hinweis: "Veranstaltungen in Slowenisch-Kärnten (Koroška): Slovenj Gradec (Windischgraz), Ravne na Koroškem (Gutenstein), Dravograd (Unterdrauburg), Radlje ob Dravi (Mahrenberg), Prevalje, Mežica. „SG“ = Slovenj Gradec." },
  // Friaul-Julisch Venetien (Tarvis siehe oben)
  { id: "ki-turismofvg", name: "Friaul-Julisch Venetien – Veranstaltungen (turismofvg.it)", url: "https://www.turismofvg.it/eventi", land: "IT", region: "Friaul-Julisch Venetien", hinweis: "Offizielles Tourismusportal von Friaul-Julisch Venetien. Wenn eine Veranstaltung an vielen Orten gleichzeitig stattfindet, nur den ersten Ort angeben." },
  { id: "ki-udinetoday", name: "UdineToday – Eventi", url: "https://www.udinetoday.it/eventi/", land: "IT", region: "Friaul-Julisch Venetien", hinweis: "Veranstaltungen in der Provinz Udine (Friaul). Sagre (Dorffeste) → feste-brauchtum oder kulinarik-wein, Mercatini di Natale → advent. Weglassen: Kurse („Corsi“), Kino, Werbung/Shopping-Aktionen, Wellness-Angebote, Gesundheits- und Impfvorträge, Buchvorstellungen, Bibliotheksveranstaltungen und Tagungen.", weitereSeiten: ["https://www.udinetoday.it/eventi/pag/2/", "https://www.udinetoday.it/eventi/pag/3/"] },
  { id: "ki-planica", name: "Planica", url: "https://www.planica.si/en", land: "SI", region: "Oberkrain", hinweis: "Ort ist Planica bei Rateče/Kranjska Gora, Slowenien. Skisprung-Veranstaltungen." },
];

const KAT_IDS = KATEGORIEN.map((k) => k.id);

/** Bei Änderungen an Anweisung oder Schema erhöhen → alle Seiten werden neu an die KI geschickt. */
const ANWEISUNG_VERSION = "4";

const SCHEMA = {
  type: "OBJECT",
  properties: {
    events: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          titel: { type: "STRING", description: "Name des Events auf Deutsch (übersetzt, falls nötig). Eigennamen nicht übersetzen." },
          beschreibung: { type: "STRING", description: "1–2 Sätze auf Deutsch, höchstens 200 Zeichen, eigene Worte." },
          originalsprache: { type: "STRING", enum: ["de", "sl", "it", "en"] },
          datum_beginn: { type: "STRING", description: "YYYY-MM-DD" },
          uhrzeit_beginn: { type: "STRING", description: "HH:MM oder leer, wenn keine Uhrzeit genannt ist" },
          datum_ende: { type: "STRING", description: "YYYY-MM-DD oder leer" },
          uhrzeit_ende: { type: "STRING", description: "HH:MM oder leer" },
          ort: { type: "STRING", description: "Ortschaft, z. B. „Velden am Wörthersee“" },
          veranstaltungsort: { type: "STRING", description: "Gebäude/Platz, z. B. „Congress Center Villach“, oder leer" },
          adresse: { type: "STRING", description: "Straße und PLZ, falls genannt, sonst leer" },
          kategorie: { type: "STRING", enum: KAT_IDS },
          preis: { type: "STRING", description: "Preisangabe wie auf der Seite, sonst leer" },
          gratis: { type: "BOOLEAN" },
          freiluft: { type: "BOOLEAN" },
          link: { type: "STRING", description: "Link zur Detailseite des Events aus dem Text (in <…>), sonst leer" },
          jahr_erschlossen: { type: "BOOLEAN", description: "true, wenn das Jahr NICHT auf der Seite steht und erschlossen wurde" },
          unsicher: { type: "BOOLEAN", description: "true, wenn Datum oder Ort nicht eindeutig sind" },
        },
        required: ["titel", "datum_beginn", "ort", "kategorie", "unsicher", "jahr_erschlossen"],
      },
    },
  },
  required: ["events"],
};

interface KiEvent {
  titel: string;
  beschreibung?: string;
  originalsprache?: string;
  datum_beginn: string;
  uhrzeit_beginn?: string;
  datum_ende?: string;
  uhrzeit_ende?: string;
  ort: string;
  veranstaltungsort?: string;
  adresse?: string;
  kategorie: string;
  preis?: string;
  gratis?: boolean;
  freiluft?: boolean;
  link?: string;
  jahr_erschlossen: boolean;
  unsicher: boolean;
}

function prompt(seite: KiSeite, text: string): string {
  const heute = wienTag(new Date());
  return `Du liest den Text einer Webseite und listest alle darin genannten Veranstaltungen auf.
Heute ist der ${heute}. Region: ${seite.region} (${seite.land}).
${seite.hinweis ? `Hinweis zur Seite: ${seite.hinweis}\n` : ""}
Regeln:
- Nur Veranstaltungen, die wirklich im Text stehen. Nichts erfinden, nichts aus eigenem Wissen ergänzen.
- Nur künftige oder laufende Veranstaltungen (Ende am oder nach ${heute}).
- Datum genau so übernehmen, wie es im Text steht. Fehlt das Jahr, nimm das nächste passende Datum ab heute und setze jahr_erschlossen = true.
- Veranstaltungen ohne erkennbares Datum oder ohne Ort weglassen.
- Wiederkehrende Termine (z. B. „jeden Freitag“) nur mit den ausdrücklich genannten Daten, höchstens 3.
- Mehrtägige Veranstaltungen als EIN Eintrag mit datum_beginn und datum_ende.
- Titel und Beschreibung IMMER auf Deutsch. Italienische/slowenische Titel übersetzen, nur echte Eigennamen bleiben (z. B. „La magia del Natale: Advento“ → „Weihnachtszauber: Advent“, „Treno storico dei Krampus“ → „Historischer Krampus-Zug“, „Advent Pur“ bleibt „Advent Pur“). Beschreibung in eigenen Worten, kurz.
- Zu jedem Event den Link zu seiner eigenen Detailseite angeben, wenn im Text einer steht (<…>).
- Märkte (Adventmärkte, Christkindlmärkte, Bauernmärkte), Feste und mehrtägige Veranstaltungen SIND Veranstaltungen und gehören unbedingt dazu – als eigener Eintrag mit ihrem Zeitraum, zusätzlich zu einzelnen Programmpunkten.
- Sei vollständig: lieber alle genannten Termine aufnehmen als welche auslassen.
- Weglassen: Gottesdienste, Kurse/Workshops, Fachvorträge, Tagungen und Gremiensitzungen.
- Ortsnamen in Slowenien und Italien: Originalname, bei bekanntem deutschem Namen diesen in Klammern dahinter, z. B. „Ljubljana (Laibach)“, „Kranj (Krainburg)“, „Tarvisio (Tarvis)“, „Gorizia (Görz)“, „Trieste (Triest)“, „Slovenj Gradec (Windischgraz)“. Ohne bekannten deutschen Namen nur den Originalnamen.
- Kategorie: Faschingssitzungen, Kirchtage, Krampus/Perchten, Brauchtum → feste-brauchtum; Adventmärkte und Weihnachtliches → advent;
  Schlager, Volksmusik, Blasmusik, Oberkrainer, slowenische „narodnozabavna“-Musik und Ensembles („ansambel“) → schlager-volksmusik; italienische Sagre → feste-brauchtum (bei Essen im Mittelpunkt kulinarik-wein); Theater, Oper, Lesungen, Ausstellungen, klassische Konzerte → klassik-kultur.
- unsicher = true, wenn du dir bei Datum oder Ort nicht sicher bist.

Text der Seite ${seite.url}:
"""
${text}
"""`;
}

function zuDatum(tag: string, uhrzeit?: string): Date | null {
  const m = tag?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const u = uhrzeit?.match(/^(\d{1,2}):(\d{2})/);
  return wienZeit(Number(m[1]), Number(m[2]), Number(m[3]), u ? Number(u[1]) : 0, u ? Number(u[2]) : 0);
}

function inRohEvents(seite: KiSeite, liste: KiEvent[]): RohEvent[] {
  const out: RohEvent[] = [];
  for (const e of liste) {
    const beginn = zuDatum(e.datum_beginn, e.uhrzeit_beginn);
    if (!beginn || !e.titel?.trim() || !e.ort?.trim()) continue;
    const endTag = e.datum_ende || (e.uhrzeit_ende ? e.datum_beginn : "");
    let ende = endTag ? zuDatum(endTag, e.uhrzeit_ende || (e.uhrzeit_beginn ? undefined : "23:59")) ?? undefined : undefined;
    if (ende && ende < beginn) ende = undefined;
    const ganztaegig = !e.uhrzeit_beginn;

    const kategorie = (KAT_IDS as readonly string[]).includes(e.kategorie) ? (e.kategorie as KategorieId) : "sonstiges";
    const kategorien = new Set<KategorieId>([kategorie, ...kategorienAusText(`${e.titel} ${e.beschreibung ?? ""}`)]);
    if (kategorien.size > 1) kategorien.delete("sonstiges");

    let url = seite.url;
    let urlIstDetail = false;
    if (e.link) {
      try {
        // „villacher-fasching.at/veranstaltungen/“ (ohne https://) wäre sonst ein Pfad unter der Seite
        const roh = e.link.replace(/[<>]/g, "").trim().replace(/^(www\.)?([a-z0-9-]+\.)+[a-z]{2,}\//i, (m) => `https://${m}`);
        url = new URL(roh, seite.url).href;
        urlIstDetail = url !== seite.url && !(seite.weitereSeiten ?? []).includes(url);
      } catch {
        /* Seiten-URL behalten */
      }
    }
    const landName = { AT: "Österreich", SI: "Slowenien", IT: "Italien" }[seite.land];
    out.push({
      quelleId: seite.id,
      url,
      urlIstDetail,
      titel: e.titel.trim(),
      beschreibung: e.beschreibung?.trim().slice(0, 300) || undefined,
      originalsprache: e.originalsprache ?? "de",
      beginn,
      ende,
      ganztaegig,
      ortName: [e.veranstaltungsort, e.ort].filter((x) => x && x.trim()).join(", "),
      adresse: [e.adresse, e.ort, landName].filter((x) => x && x.trim()).join(", "),
      land: seite.land,
      region: seite.region,
      kategorien: [...kategorien],
      preisText: e.preis || undefined,
      gratis: e.gratis,
      freiluft: e.freiluft ?? null,
      sicherheit: e.unsicher || e.jahr_erschlossen ? "unsicher" : "sicher",
    });
  }
  return out;
}

export function kiQuelle(seite: KiSeite): Quelle {
  return {
    id: seite.id,
    name: seite.name,
    url: seite.url,
    art: "ki",
    land: seite.land,
    horizontTage: 0, // KI-Ergebnisse schwanken leicht → keine automatische „verschwunden“-Markierung
    async holen(k) {
      if (!kiVerfuegbar()) throw new Error("GEMINI_API_KEY fehlt – KI-Quellen übersprungen");
      const html = await k.holeText(seite.url);
      let text = seitenText(html, seite.url, seite.weitereSeiten?.length ? 15_000 : 40_000);
      for (const weitere of seite.weitereSeiten ?? []) {
        try {
          text += `

--- weitere Seite ${weitere} ---
` + seitenText(await k.holeText(weitere), weitere, 15_000);
        } catch (err) {
          k.log(`  weitere Seite nicht lesbar: ${(err as Error).message}`);
        }
      }
      // Hinweis gehört dazu: Wird er geändert, liest die KI die Seite neu
      const hash = createHash("sha256").update(`${ANWEISUNG_VERSION}|${seite.hinweis ?? ""}|${text}`).digest("hex");

      const { rows } = await db().query("SELECT inhalt_hash, ergebnis FROM ki_cache WHERE url = $1", [seite.url]);
      let liste: KiEvent[];
      if (rows[0]?.inhalt_hash === hash) {
        liste = rows[0].ergebnis.events ?? [];
        k.log(`  Seite unverändert – ${liste.length} Events aus dem Zwischenspeicher (keine KI nötig)`);
      } else {
        const antwort = await kiJson<{ events: KiEvent[] }>(prompt(seite, text), SCHEMA);
        liste = antwort.events ?? [];
        await db().query(
          `INSERT INTO ki_cache (url, inhalt_hash, ergebnis) VALUES ($1, $2, $3)
           ON CONFLICT (url) DO UPDATE SET inhalt_hash = EXCLUDED.inhalt_hash, ergebnis = EXCLUDED.ergebnis, abgerufen = now()`,
          [seite.url, hash, JSON.stringify({ events: liste })]
        );
        k.log(`  KI hat ${liste.length} Events gefunden`);
      }
      return { events: inRohEvents(seite, liste), hinweise: [] };
    },
  };
}
