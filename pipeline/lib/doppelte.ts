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

export function fingerabdruck(titel: string, tag: string, lat: number, lng: number): string {
  return `${normalisiere(titel).slice(0, 80)}|${tag}|${lat.toFixed(2)},${lng.toFixed(2)}`;
}
