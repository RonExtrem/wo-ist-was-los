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

/** Ähnlichkeit zweier Titel von 0 bis 1. */
export function titelAehnlichkeit(a: string, b: string): number {
  const A = woerter(a);
  const B = woerter(b);
  if (!A.size || !B.size) return 0;
  let gemeinsam = 0;
  for (const w of A) if (B.has(w)) gemeinsam++;
  const kleiner = Math.min(A.size, B.size);
  if (gemeinsam === kleiner) return Math.max(0.8, gemeinsam / Math.max(A.size, B.size)); // einer steckt im anderen
  return (2 * gemeinsam) / (A.size + B.size);
}

/** Buchstaben-Dreier-Ähnlichkeit ohne Leerzeichen – erkennt „Weltcup-Finale“ = „Weltcupfinale“. */
export function zeichenAehnlichkeit(a: string, b: string): number {
  const dreier = (t: string) => {
    const s = normalisiere(t).replace(/\b20\d\d\b/g, "").replace(/ /g, "");
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
export function gleichesEvent(a: string, b: string, meter: number, gleicheQuelle: boolean): number {
  const worte = titelAehnlichkeit(a, b);
  if (gleicheQuelle) return meter <= 2000 && worte >= 0.5 ? worte : 0;
  const zeichen = zeichenAehnlichkeit(a, b);
  const wert = Math.max(worte, zeichen);
  if (meter <= 2000 && (worte >= 0.5 || zeichen >= 0.65)) return wert;
  // Weiter weg nur bei aussagekräftigem Titel: „Kinderfasching“ gibt es in jedem Nachbarort
  const kuerzer = Math.min(woerter(a).size, woerter(b).size);
  if (meter <= 8000 && wert >= 0.8 && kuerzer >= 2) return wert;
  return 0;
}

export function fingerabdruck(titel: string, tag: string, lat: number, lng: number): string {
  return `${normalisiere(titel).slice(0, 80)}|${tag}|${lat.toFixed(2)},${lng.toFixed(2)}`;
}
