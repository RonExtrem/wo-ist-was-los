// Inhalt der geführten Tour – einfach erklärt, Schritt für Schritt durch alle Reiter.
import type { ReactNode } from "react";

export interface TourSchritt {
  /** Auf welcher Seite der Schritt spielt */
  seite: string;
  /** CSS-Auswahl des hervorgehobenen Elements (leer = Fenster in der Mitte) */
  ziel?: string;
  titel: string;
  text: ReactNode;
  /** Mitmach-Schritt: erst weiter, wenn man selbst auf das Markierte getippt hat und auf dieser Seite landet */
  tippen?: { weiterBei: string; hinweis: string };
}

const leiste = (href: string) => `nav[aria-label="Hauptbereiche"] a[href="${href}"]`;

export const TOUR: TourSchritt[] = [
  // ── Start ──
  {
    seite: "/",
    titel: "Willkommen zur Tour 👋",
    text: (
      <>
        In ungefähr <strong>2 Minuten</strong> zeige ich dir alles, was die App kann. Ein paar Mal tippst du selbst – so lernt man es am
        schnellsten. Du kannst jederzeit mit dem <strong>X</strong> aufhören.
      </>
    ),
  },
  {
    seite: "/",
    ziel: '[data-tour="startpunkt"]',
    titel: "Von wo aus suchen?",
    text: (
      <>
        Normalerweise misst die App Entfernungen ab <strong>daheim</strong>. Bist du unterwegs, tippst du auf <strong>„Wo ich gerade bin“</strong>
        . Mit <strong>„Anderer Ort“</strong> suchst du rund um einen beliebigen Ort – auch per Postleitzahl.
      </>
    ),
  },
  {
    seite: "/",
    ziel: '[data-tour="laender"]',
    titel: "Österreich, Slowenien, Italien",
    text: "Die Zahl sagt, wie viele Veranstaltungen es in deiner Gegend im jeweiligen Land gibt. Antippen zeigt nur dieses Land.",
  },
  {
    seite: "/",
    ziel: '[data-tour="ansicht"]',
    titel: "So, wie es dir gefällt",
    text: (
      <>
        <strong>Groß</strong> zeigt große Bilder, <strong>Kacheln</strong> zwei nebeneinander, <strong>Liste</strong> möglichst viele auf
        einmal. Die App merkt sich deine Wahl.
      </>
    ),
  },
  {
    seite: "/",
    ziel: '[data-tour="abschnitt"] li',
    titel: "Eine Veranstaltung",
    text: "Antippen öffnet alle Details: Uhrzeit, Ort, Wetter, Fahrzeit, Route, „In Kalender eintragen“ und den Link zur Originalseite.",
  },
  {
    seite: "/",
    ziel: '[data-tour="abschnitt"] li [aria-label*="merken"]',
    titel: "Das Herz ♥ = merken",
    text: (
      <>
        Mit dem Herz merkst du dir eine Veranstaltung. Die App fragt dann, ob sie dich <strong>am Vortag und am Tag selbst erinnern</strong>{" "}
        soll. Wird etwas abgesagt oder verschoben, bekommst du Bescheid.
      </>
    ),
  },
  {
    seite: "/",
    ziel: leiste("/suchen"),
    titel: "Jetzt du: Suchen",
    text: "Unten sind die vier Bereiche der App. Probier's aus:",
    tippen: { weiterBei: "/suchen", hinweis: "Tipp auf „Suchen“" },
  },
  // ── Suchen ──
  {
    seite: "/suchen",
    ziel: 'input[aria-label="Suchbegriff"]',
    titel: "Nach etwas suchen",
    text: "Hier kannst du ein Wort eintippen, zum Beispiel „Kirchtag“, „Krampus“ oder einen Ortsnamen.",
  },
  {
    seite: "/suchen",
    ziel: '[data-tour="wann"]',
    titel: "Wann?",
    text: "Wähle den Zeitraum: heute & morgen, das Wochenende oder länger voraus.",
  },
  {
    seite: "/suchen",
    ziel: '[data-tour="wie-weit"]',
    titel: "Wie weit?",
    text: "Wie weit du fahren magst – von 10 km bis „Alle“.",
  },
  {
    seite: "/suchen",
    ziel: '[data-tour="mehr-filter"]',
    titel: "Was & wo genau?",
    text: "Hier wählst du Themen (zum Beispiel nur Advent oder nur Schlager), Länder und „nur gratis“.",
  },
  {
    seite: "/suchen",
    ziel: leiste("/karte"),
    titel: "Jetzt du: Karte",
    text: "Auf der Karte siehst du, wo überall etwas los ist.",
    tippen: { weiterBei: "/karte", hinweis: "Tipp auf „Karte“" },
  },
  // ── Karte ──
  {
    seite: "/karte",
    ziel: '[data-tour="karte-filter"]',
    titel: "Oben wählst du aus",
    text: "Zeitraum, Ort, Umkreis und welche Arten von Veranstaltungen auf der Karte erscheinen.",
  },
  {
    seite: "/karte",
    titel: "Die Zahlen im Kreis",
    text: (
      <>
        Liegen viele Veranstaltungen nah beieinander, fasst die Karte sie zu einem <strong>Kreis mit Zahl</strong> zusammen. Tippst du ihn
        an, kommt unten die Liste – mit „Auf der Karte zeigen“ zoomst du genau hin. Zurück-Taste schließt die Liste wieder.
      </>
    ),
  },
  {
    seite: "/karte",
    ziel: 'button[aria-label="Ort auf der Karte antippen"]',
    titel: "Ort direkt antippen",
    text: "Mit diesem Knopf tippst du danach irgendwo auf die Karte – dort wird dann gesucht. Die rote Linie zeigt das Gebiet der App.",
  },
  {
    seite: "/karte",
    ziel: 'button[aria-label="Satellitenbild zeigen"], button[aria-label="Normale Karte zeigen"]',
    titel: "Satellit",
    text: "Schaltet zwischen normaler Karte und Satellitenbild um.",
  },
  {
    seite: "/karte",
    ziel: leiste("/meine"),
    titel: "Jetzt du: Meine",
    text: "Dort findest du alles, was du dir gemerkt hast.",
    tippen: { weiterBei: "/meine", hinweis: "Tipp auf „Meine“" },
  },
  // ── Meine ──
  {
    seite: "/meine",
    ziel: "main h1",
    titel: "Meine Events",
    text: "Alle Veranstaltungen mit Herz, nach Datum sortiert. Was schon vorbei ist, steht ausgegraut darunter.",
  },
  {
    seite: "/meine",
    ziel: 'main a[href="/teilen"]',
    titel: "Selbst eintragen",
    text: (
      <>
        Fehlt dir etwas? Hier trägst du eine Veranstaltung selbst ein. Noch einfacher: Siehst du in <strong>Facebook, WhatsApp</strong> oder im
        Internet ein Fest, tippst du dort auf <strong>„Teilen“</strong> und wählst <strong>„Wo is wos los?“</strong> – die App füllt dann
        alles für dich aus.
      </>
    ),
  },
  {
    seite: "/meine",
    ziel: leiste("/"),
    titel: "Jetzt du: Start",
    text: "Zurück zur Startseite.",
    tippen: { weiterBei: "/", hinweis: "Tipp auf „Start“" },
  },
  {
    seite: "/",
    ziel: 'a[aria-label="Einstellungen"]',
    titel: "Jetzt du: Einstellungen",
    text: "Das Zahnrad oben rechts öffnet die Einstellungen.",
    tippen: { weiterBei: "/einstellungen", hinweis: "Tipp auf das Zahnrad" },
  },
  // ── Einstellungen ──
  {
    seite: "/einstellungen",
    titel: "Deine Einstellungen",
    text: (
      <>
        Hier änderst du deinen Namen, wo du daheim bist, wie weit du fährst, deine Interessen, die <strong>Erinnerungen aufs Handy</strong>{" "}
        und die <strong>Schriftgröße</strong>. Ganz oben unter <strong>„Hilfe“</strong> kannst du diese Tour jederzeit nochmal starten.
      </>
    ),
  },
  {
    seite: "/einstellungen",
    titel: "Woher kommen die Veranstaltungen?",
    text: (
      <>
        Jede <strong>Nacht</strong> sammelt die App automatisch neue Veranstaltungen von vielen Seiten – Gemeinden, Bezirksblättern,
        Tourismus-Seiten in Österreich, Slowenien und Italien. <strong>In der Früh</strong> ist alles aktuell. Vorbei ist vorbei: Alte
        Veranstaltungen verschwinden von selbst.
      </>
    ),
  },
  {
    seite: "/einstellungen",
    titel: "Geschafft! 🎉",
    text: "Jetzt kennst du alles. Viel Spaß beim Entdecken – und schönen Ausflug!",
  },
];
