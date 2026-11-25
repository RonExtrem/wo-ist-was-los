// Kategorien von „Wo is wos los?“ – gemeinsam genutzt von App und Event-Sammler.

export const KATEGORIEN = [
  { id: "messen-maerkte", name: "Messen & Märkte", farbe: "#0B6E78" },
  { id: "schlager-volksmusik", name: "Schlager & Volksmusik", farbe: "#C2410C" },
  { id: "feste-brauchtum", name: "Feste, Kirchtage & Brauchtum", farbe: "#3F6B4E" },
  { id: "kulinarik-wein", name: "Kulinarik & Wein", farbe: "#9F1239" },
  { id: "advent", name: "Advent & Weihnachtsmärkte", farbe: "#B45309" },
  { id: "pop-rock-party", name: "Pop, Rock & Party", farbe: "#7C3AED" },
  { id: "klassik-kultur", name: "Klassik, Theater & Kultur", farbe: "#1D4ED8" },
  { id: "sport", name: "Sport", farbe: "#0F766E" },
  { id: "familie-kinder", name: "Familie & Kinder", farbe: "#DB2777" },
  { id: "oldtimer-technik", name: "Oldtimer & Technik", farbe: "#475569" },
  { id: "natur-ausfluege", name: "Natur & Ausflüge", farbe: "#65A30D" },
  { id: "sonstiges", name: "Sonstiges", farbe: "#6B7A80" },
] as const;

export type KategorieId = (typeof KATEGORIEN)[number]["id"];

/** Papas Lieblingsthemen (Grill-Me-Runde): bekommen Vorrang bei „Für dich“. */
export const STANDARD_INTERESSEN: KategorieId[] = [
  "messen-maerkte",
  "schlager-volksmusik",
  "feste-brauchtum",
  "kulinarik-wein",
];

/** Stichwörter im Titel/Text → zusätzliche Kategorien (Kleinschreibung, ohne Umlaut-Sonderfälle). */
const STICHWOERTER: [RegExp, KategorieId][] = [
  [/advent|christkind|weihnacht|krampus|nikolo|perchten|adventmarkt|punsch/, "advent"],
  [/kirchtag|kirchtog|zeltfest|feuerwehrfest|dorffest|sommerfest|seefest|brauchtum|trachten|fasching|maibaum|almabtrieb|erntedank|bauernherbst/, "feste-brauchtum"],
  [/schlager|volksmusik|volkstüml|oberkrainer|musikanten|musikantenstadl|blasmusik|trachtenkapelle|zither|harmonika|alpenrock|kastelruther|amigos/, "schlager-volksmusik"],
  [/wein|martini|kulinari|genuss|kastanie|bauernmarkt|schnaps|bier|brot|käse|kas |reindling|kasnud/, "kulinarik-wein"],
  [/messe|flohmarkt|markt|basar|börse|bazar/, "messen-maerkte"],
  [/oldtimer|traktor|classic cars|auto&bike|motorrad|technik/, "oldtimer-technik"],
  [/rock|pop|party|clubbing|dj |disco|festival|open air|open-air/, "pop-rock-party"],
  [/konzert|theater|kabarett|lesung|ausstellung|orchester|chor|oper|klassik|museum/, "klassik-kultur"],
  [/kinder|familie|baby|\bjugend|kasperl|zirkus|vergnügungspark|gaudepark|frühlingsfest/, "familie-kinder"],
  [/\blauf\b|(stadt|silvester|volks|berg|nacht|benefiz|charity|oster|kinder|staffel|crosscountry|trail)lauf|marathon|turnier|radrennen|skirennen|eishockey|fußball|triathlon|\bski\b|eislaufen/, "sport"],
  [/wanderung|führung|naturpark|\balm\b|almwanderung|ausflug/, "natur-ausfluege"],
];

export function kategorienAusText(text: string): KategorieId[] {
  const t = text.toLowerCase();
  const gefunden = new Set<KategorieId>();
  for (const [muster, kat] of STICHWOERTER) if (muster.test(t)) gefunden.add(kat);
  // „Messe“ kann auch ein Gottesdienst sein (Rorate-Messe, Bergmesse …)
  const gottesdienst = /rorate|gottesdienst|hl\. messe|heilige messe|feldmesse|bergmesse|almmesse|waldmesse|seemesse|pfarr|kirche|andacht/.test(t);
  if (gottesdienst && !/markt|basar|börse|bazar|fachmesse|freizeitmesse|herbstmesse/.test(t)) gefunden.delete("messen-maerkte");
  return [...gefunden];
}

/** Freiluft-Hinweis aus dem Text (für die Wetteranzeige). null = unbekannt. */
export function freiluftAusText(text: string): boolean | null {
  const t = text.toLowerCase();
  if (/open air|open-air|zeltfest|kirchtag|seefest|almfest|im freien|freiluft|bauernmarkt|wanderung|lauf|marathon|platzkonzert|adventmarkt|christkindlmarkt|flohmarkt/.test(t)) return true;
  if (/halle|saal|kirche|theater|kino|museum|messe|stadtsaal|kulturhaus|gasthaus|gasthof/.test(t)) return false;
  return null;
}
