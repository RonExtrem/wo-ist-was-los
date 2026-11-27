// Erkennt, ob zwei Einträge dasselbe Event sind (gleicher Tag ±1, Ort < 2 km, ähnlicher Titel).

const FUELLWOERTER = new Set([
  "der", "die", "das", "und", "im", "in", "am", "an", "auf", "zum", "zur", "mit", "von", "vom", "bei", "für", "fur",
  "ein", "eine", "the", "of", "&", "-", "2026", "2027", "2028", "il", "la", "di", "e", "in", "na", "v", "pri",
]);

export function normalisiere(text: string): string {
  return text
    .toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function woerter(text: string): Set<string> {
  return new Set(normalisiere(text).split(" ").filter((w) => w.length > 1 && !FUELLWOERTER.has(w)));
}

/** Wörter ohne die Ortsnamen – „Krampuslauf Velden“ und „Adventmarkt Velden“ teilen nur den Ort, sind aber verschieden. */
function ohneOrt(w: Set<string>, ohne?: Set<string>): Set<string> {
  if (!ohne?.size) return w;
  const rest = new Set([...w].filter((x) => !ohne.has(x)));
  return rest.size ? rest : w; // Titel besteht nur aus dem Ort → doch vergleichen
}

/** Wörter aus Ortsangaben (z. B. „Velden, Velden am Wörthersee“) zum Herausnehmen beim Vergleich. */
export function ortsWoerter(...orte: (string | null | undefined)[]): Set<string> {
  return new Set(orte.flatMap((o) => (o ? [...woerter(o)] : [])));
}

/** Ähnlichkeit zweier Titel von 0 bis 1 (Ortsnamen zählen nicht mit). */
export function titelAehnlichkeit(a: string, b: string, ohne?: Set<string>): number {
  const A = ohneOrt(woerter(a), ohne);
  const B = ohneOrt(woerter(b), ohne);
  if (!A.size || !B.size) return 0;
  let gemeinsam = 0;
  for (const w of A) if (B.has(w)) gemeinsam++;
  const kleiner = Math.min(A.size, B.size);
  if (gemeinsam === kleiner) return Math.max(0.8, gemeinsam / Math.max(A.size, B.size)); // einer steckt im anderen
  return (2 * gemeinsam) / (A.size + B.size);
}

/** Buchstaben-Dreier-Ähnlichkeit ohne Leerzeichen – erkennt „Weltcup-Finale“ = „Weltcupfinale“. */
export function zeichenAehnlichkeit(a: string, b: string, ohne?: Set<string>): number {
  const dreier = (t: string) => {
    const alle = normalisiere(t).replace(/\b20\d\d\b/g, "").split(" ").filter(Boolean);
    const ohneOrte = ohne?.size ? alle.filter((w) => !ohne.has(w)) : alle;
    const s = (ohneOrte.length ? ohneOrte : alle).join("");
    const m = new Map<string, number>();
    for (let i = 0; i < s.length - 2; i++) m.set(s.slice(i, i + 3), (m.get(s.slice(i, i + 3)) ?? 0) + 1);
    return { m, n: Math.max(s.length - 2, 0) };
  };
  const A = dreier(a);
  const B = dreier(b);
  if (!A.n || !B.n) return 0;
  let gemeinsam = 0;
  for (const [k, v] of A.m) gemeinsam += Math.min(v, B.m.get(k) ?? 0);
  return (2 * gemeinsam) / (A.n + B.n);
}

/**
 * Wie sicher sind zwei Einträge (±1 Tag) dasselbe Event? 0 = nein, sonst Ähnlichkeit.
 * Aus verschiedenen Quellen: < 2 km und ähnlicher Titel, oder < 8 km und fast gleicher Titel
 * (Quellen setzen den Punkt oft verschieden: Ortsmitte statt Festplatz).
 * Aus derselben Quelle zählt nur der Wort-Vergleich (sonst verschmelzen „… – Temple Brass“ und „… – Du Brass“).
 */
export function gleichesEvent(a: string, b: string, meter: number, gleicheQuelle: boolean, orte?: Set<string>): number {
  const worte = titelAehnlichkeit(a, b, orte);
  if (gleicheQuelle) return meter <= 2000 && worte >= 0.5 ? worte : 0;
  const zeichen = zeichenAehnlichkeit(a, b, orte);
  const wert = Math.max(worte, zeichen);
  if (meter <= 2000 && (worte >= 0.5 || zeichen >= 0.65)) return wert;
  // Weiter weg nur bei aussagekräftigem Titel: „Kinderfasching“ gibt es in jedem Nachbarort
  const kuerzer = Math.min(ohneOrt(woerter(a), orte).size, ohneOrt(woerter(b), orte).size);
  if (meter <= 8000 && wert >= 0.8 && kuerzer >= 2) return wert;
  return 0;
}

/**
 * SQL: Kategorien zweier Einträge vereinen – Reihenfolge bleibt (die erste ist die Hauptkategorie),
 * „sonstiges“ fällt weg, sobald es eine echte gibt.
 */
export function kategorienVereinenSql(a: string, b: string): string {
  return `(SELECT CASE WHEN bool_or(x.k <> 'sonstiges') THEN array_agg(x.k ORDER BY x.i) FILTER (WHERE x.k <> 'sonstiges')
                  ELSE ARRAY['sonstiges'] END
             FROM (SELECT t.k, min(t.i) AS i FROM unnest(${a} || ${b}) WITH ORDINALITY AS t(k, i) GROUP BY t.k) x)`;
}

export function fingerabdruck(titel: string, tag: string, lat: number, lng: number): string {
  return `${normalisiere(titel).slice(0, 80)}|${tag}|${lat.toFixed(2)},${lng.toFixed(2)}`;
}
