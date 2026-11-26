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
        In <strong>2 Minuten</strong> zeige ich dir alles. Ein paar Mal tippst du selbst. Mit dem <strong>X</strong> hörst du jederzeit auf.
      </>
    ),
  },
  {
    seite: "/",
    ziel: '[data-tour="startpunkt"]',
    titel: "Von wo aus suchen?",
    text: (
      <>
        Die App misst ab <strong>daheim</strong>. Unterwegs: <strong>„Wo ich gerade bin“</strong>. Oder <strong>„Anderer Ort“</strong> – auch per
        Postleitzahl.
      </>
    ),
  },
  {
    seite: "/",
    ziel: '[data-tour="laender"]',
    titel: "Österreich, Slowenien, Italien",
    text: "Wie viele Veranstaltungen es in deiner Gegend pro Land gibt. Antippen zeigt nur dieses Land.",
  },
  {
    seite: "/",
    ziel: '[data-tour="ansicht"]',
    titel: "So, wie es dir gefällt",
    text: (
      <>
        <strong>Groß</strong> mit Bildern, <strong>Kacheln</strong> zwei nebeneinander, <strong>Liste</strong> möglichst viele auf einmal.
      </>
    ),
  },
  {
    seite: "/",
    ziel: '[data-tour="abschnitt"] li',
    titel: "Eine Veranstaltung",
    text: "Antippen zeigt alles: Uhrzeit, Wetter, Fahrzeit, Route, Kalender und die Originalseite.",
  },
  {
    seite: "/",
    ziel: '[data-tour="abschnitt"] li [aria-label*="merken"]',
    titel: "Das Herz ♥ = merken",
    text: (
      <>
        Merkt die Veranstaltung. Auf Wunsch <strong>erinnert</strong> dich die App am Vortag und am Tag selbst – und meldet Absagen.
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
    text: "Ein Wort eintippen, z. B. „Kirchtag“, „Krampus“ oder einen Ort.",
  },
  {
    seite: "/suchen",
    ziel: '[data-tour="wann"]',
    titel: "Wann?",
    text: "Der Zeitraum: heute & morgen, Wochenende oder länger.",
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
    titel: "Genauer eingrenzen",
    text: "Themen (z. B. nur Advent), Land & Bundesland (z. B. nur Kärnten) und „nur gratis“.",
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
    text: "Zeitraum, Ort, Umkreis und welche Arten auf der Karte erscheinen.",
  },
  {
    seite: "/karte",
    titel: "Die Zahlen im Kreis",
    text: (
      <>
        Viele Veranstaltungen nah beieinander werden zu einem <strong>Kreis mit Zahl</strong>. Antippen zeigt sie als Liste, „Auf der Karte
        zeigen“ zoomt hin. Die Zurück-Taste schließt die Liste.
      </>
    ),
  },
  {
    seite: "/karte",
    ziel: 'button[aria-label="Ort auf der Karte antippen"]',
    titel: "Ort direkt antippen",
    text: "Danach irgendwo auf die Karte tippen – dort wird gesucht. Die rote Linie zeigt das Gebiet der App.",
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
    text: "Alles mit Herz, nach Datum. Vergangenes steht ausgegraut darunter.",
  },
  {
    seite: "/meine",
    ziel: 'main a[href="/teilen"]',
    titel: "Selbst eintragen",
    text: (
      <>
        Fehlt etwas? Hier selbst eintragen. Oder in <strong>Facebook/WhatsApp</strong> auf <strong>„Teilen“</strong> →{" "}
        <strong>„Wo is wos los?“</strong> – die App füllt alles aus.
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
        Name, Daheim, Umkreis, Interessen, <strong>Erinnerungen</strong> und <strong>Schriftgröße</strong>. Ganz oben unter{" "}
        <strong>„Hilfe“</strong> startest du diese Tour jederzeit neu.
      </>
    ),
  },
  {
    seite: "/einstellungen",
    titel: "Woher kommen die Veranstaltungen?",
    text: (
      <>
        Jede <strong>Nacht</strong> sammelt die App neue Veranstaltungen von Gemeinden, Bezirksblättern und Tourismus-Seiten in Österreich,
        Slowenien und Italien. <strong>In der Früh</strong> ist alles aktuell, Vergangenes verschwindet von selbst.
      </>
    ),
  },
  {
    seite: "/einstellungen",
    titel: "Geschafft! 🎉",
    text: "Jetzt kennst du alles. Viel Spaß beim Entdecken – und schönen Ausflug!",
  },
];
