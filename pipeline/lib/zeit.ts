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

/**
 * schema.org-Zeitangabe lesen.
 * „2026-12-02“ (nur Datum) ist ein Kalendertag in Wien – nicht 0 Uhr UTC (das wäre 1 Uhr früh und
 * ließ Veranstaltungen am eigenen Tag aus den Listen verschwinden). Mit `bisTagesende` wird daraus 23:59.
 * „2026-12-02T19:00“ ohne Zeitzone gilt als Wiener Ortszeit (der Sammler läuft in UTC).
 */
export function ldZeit(text: string | undefined, bisTagesende = false): { zeit: Date; nurDatum: boolean } | null {
  const s = (text ?? "").trim();
  if (!s) return null;
  const nurDatum = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (nurDatum) {
    const [j, m, t] = [Number(nurDatum[1]), Number(nurDatum[2]), Number(nurDatum[3])];
    if (m < 1 || m > 12 || t < 1 || t > 31) return null; // „2026-13-45“ nicht still in den Februar 2027 rollen
    const zeit = bisTagesende ? wienZeit(j, m, t, 23, 59) : wienZeit(j, m, t);
    return Number.isNaN(zeit.getTime()) ? null : { zeit, nurDatum: true };
  }
  const ohneZone = s.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/);
  const zeit = ohneZone
    ? wienZeit(Number(ohneZone[1]), Number(ohneZone[2]), Number(ohneZone[3]), Number(ohneZone[4]), Number(ohneZone[5]))
    : new Date(s);
  return Number.isNaN(zeit.getTime()) ? null : { zeit, nurDatum: false };
}

/** 23:59 Wiener Zeit am Kalendertag von `d`. */
export function wienTagesende(d: Date): Date {
  const [j, m, t] = wienTag(d).split("-").map(Number);
  return wienZeit(j, m, t, 23, 59);
}

/** Ist es in Wien genau Mitternacht (0:00)? (Sommer- und Winterzeit) */
export function istWienMitternacht(d: Date): boolean {
  const teile = new Intl.DateTimeFormat("en-GB", { timeZone: ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d);
  return teile.find((x) => x.type === "hour")?.value === "00" && teile.find((x) => x.type === "minute")?.value === "00";
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
