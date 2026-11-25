// Datumsumrechnung: Veranstaltungszeiten sind Ortszeit (Wien/Ljubljana/Rom = gleiche Zeitzone).

const ZONE = "Europe/Vienna";

/** Versatz der Zeitzone Wien in Minuten zu einem UTC-Zeitpunkt (z. B. +60 oder +120). */
function versatzMinuten(utc: Date): number {
  const teile = new Intl.DateTimeFormat("en-US", { timeZone: ZONE, timeZoneName: "longOffset" })
    .formatToParts(utc)
    .find((t) => t.type === "timeZoneName")?.value; // "GMT+01:00"
  const m = teile?.match(/GMT([+-])(\d{2}):(\d{2})/);
  if (!m) return 0;
  const min = Number(m[2]) * 60 + Number(m[3]);
  return m[1] === "-" ? -min : min;
}

/** Ortszeit (Wien) → echter Zeitpunkt. Monat 1–12. */
export function wienZeit(jahr: number, monat: number, tag: number, stunde = 0, minute = 0): Date {
  const naiv = Date.UTC(jahr, monat - 1, tag, stunde, minute);
  // zweimal rechnen, damit Sommer-/Winterzeit-Wechsel stimmt
  let t = naiv - versatzMinuten(new Date(naiv)) * 60_000;
  t = naiv - versatzMinuten(new Date(t)) * 60_000;
  return new Date(t);
}

/** „15.01.2027“ → {jahr, monat, tag} oder null. */
export function parseDatumDE(text: string): { jahr: number; monat: number; tag: number } | null {
  const m = text.match(/(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/);
  if (!m) return null;
  const tag = Number(m[1]);
  const monat = Number(m[2]);
  const jahr = Number(m[3]);
  if (monat < 1 || monat > 12 || tag < 1 || tag > 31) return null;
  return { jahr, monat, tag };
}

/** Kalendertag in Wien als „2027-01-15“. */
export function wienTag(d: Date): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: ZONE }).format(d);
}

export function plusTage(d: Date, tage: number): Date {
  return new Date(d.getTime() + tage * 86_400_000);
}
