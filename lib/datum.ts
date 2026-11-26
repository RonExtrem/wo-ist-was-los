// Datums-Texte auf Österreichisch (Jänner!), Zeitzone Wien.

const ZONE = "Europe/Vienna";
const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("de-AT", { timeZone: ZONE, ...o });

const tagMonat = fmt({ day: "numeric", month: "long" });
const wochentagKurz = fmt({ weekday: "short" });
const wochentagLang = fmt({ weekday: "long" });
const uhrzeit = fmt({ hour: "2-digit", minute: "2-digit" });
const tagSchluessel = new Intl.DateTimeFormat("sv-SE", { timeZone: ZONE });

export function wienTag(d: Date): string {
  return tagSchluessel.format(d);
}

function tagePlus(d: Date, n: number) {
  return new Date(d.getTime() + n * 86_400_000);
}

/** „Heute“, „Morgen“ oder „Sa., 28. November“ */
export function tagText(iso: string, jetzt = new Date()): string {
  const d = new Date(iso);
  const t = wienTag(d);
  if (t === wienTag(jetzt)) return "Heute";
  if (t === wienTag(tagePlus(jetzt, 1))) return "Morgen";
  return `${wochentagKurz.format(d)} ${tagMonat.format(d)}`;
}

/** Überschrift für Datumsgruppen: „Heute · Donnerstag, 26. November“ */
export function tagUeberschrift(tag: string, jetzt = new Date()): string {
  const d = new Date(`${tag}T12:00:00`);
  const lang = `${wochentagLang.format(d)}, ${tagMonat.format(d)}`;
  if (tag === wienTag(jetzt)) return `Heute · ${lang}`;
  if (tag === wienTag(tagePlus(jetzt, 1))) return `Morgen · ${lang}`;
  return lang;
}

/** Zeitangabe für ein Event: „19:55 Uhr“, „ganztägig“ oder „15.–17. Jänner“ bei mehrtägigen. */
export function zeitText(e: { beginn: string; ende: string | null; ganztaegig: boolean }): string {
  const b = new Date(e.beginn);
  const en = e.ende ? new Date(e.ende) : null;
  const mehrtaegig = en && wienTag(en) !== wienTag(b);
  if (mehrtaegig) {
    const gleicherMonat = fmt({ month: "long" }).format(b) === fmt({ month: "long" }).format(en);
    const bisText = tagMonat.format(en);
    const vonText = gleicherMonat ? fmt({ day: "numeric" }).format(b) + "." : tagMonat.format(b);
    return `${vonText} – ${bisText}`;
  }
  if (e.ganztaegig) return "ganztägig";
  const ende = en && !e.ganztaegig ? `–${uhrzeit.format(en)}` : "";
  return `${uhrzeit.format(b)}${ende} Uhr`;
}

/** Kleines Kalenderblatt: { wochentag: "SA", tag: "28", monat: "Nov." } */
export function kalenderblatt(iso: string) {
  const d = new Date(iso);
  return {
    wochentag: wochentagKurz.format(d).replace(".", "").toUpperCase(),
    tag: fmt({ day: "numeric" }).format(d),
    monat: fmt({ month: "short" }).format(d),
  };
}

/** Läuft das Event gerade (mehrtägig, schon begonnen)? */
export function laeuftGerade(e: { beginn: string; ende: string | null }, jetzt = new Date()): boolean {
  return new Date(e.beginn) < jetzt && !!e.ende && new Date(e.ende) > jetzt;
}

/** Zeitfenster für Schnellfilter. */
export function zeitfenster(art: "heute-morgen" | "wochenende" | "woche" | "monat" | "drei-monate" | "jahr", jetzt = new Date()) {
  const tag = wienTag(jetzt);
  const mitternacht = (t: string, plusTage: number) => {
    const d = new Date(`${t}T00:00:00`);
    return tagePlus(d, plusTage);
  };
  switch (art) {
    case "heute-morgen":
      return { von: jetzt, bis: mitternacht(tag, 2) };
    case "wochenende": {
      // Freitag ab 14 Uhr bis Sonntag Nacht; am Wochenende selbst: ab jetzt
      const wt = new Date(`${tag}T12:00:00`).getDay(); // 0 = So
      const bisSonntag = wt === 0 ? 0 : 7 - wt;
      const ende = mitternacht(tag, bisSonntag + 1);
      const freitag = mitternacht(tag, wt === 0 ? -2 : 5 - wt);
      freitag.setHours(14);
      const von = jetzt > freitag ? jetzt : freitag;
      return { von, bis: ende };
    }
    case "woche":
      return { von: jetzt, bis: mitternacht(tag, 8) };
    case "monat":
      return { von: jetzt, bis: mitternacht(tag, 31) };
    case "drei-monate":
      return { von: jetzt, bis: mitternacht(tag, 92) };
    case "jahr":
      return { von: jetzt, bis: mitternacht(tag, 366) };
  }
}

const stundeFmt = fmt({ hour: "numeric", hourCycle: "h23" });

/** Aktuelle Stunde in Wien (0–23). Achtung: format() liefert „08 Uhr“, darum formatToParts. */
export function wienStunde(jetzt = new Date()): number {
  const teil = stundeFmt.formatToParts(jetzt).find((t) => t.type === "hour");
  return Number(teil?.value ?? 12);
}

export function begruessung(jetzt = new Date()): string {
  const h = wienStunde(jetzt);
  if (h < 4) return "Guten Abend";
  if (h < 11) return "Guten Morgen";
  if (h < 18) return "Servus";
  return "Guten Abend";
}

export function heuteText(jetzt = new Date()): string {
  return `${wochentagLang.format(jetzt)}, ${tagMonat.format(jetzt)}`;
}
