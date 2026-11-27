// Kurse, Beratung, Selbsthilfe, Vereinssitzungen … – sucht Papa nicht (er will Feste, Märkte, Konzerte).
// Seniorentreffs, Spielenachmittage, Reparaturcafés bleiben absichtlich drin.
const NICHT_SAMMELN =
  /\b(yoga|pilates|selbsthilfe|sprechstunde|sprechtag|meditation|therapie|seminar(?!r)|workshop|webinar|schnupper|kurs|kurse|lehrgang|coaching|achtsamkeit|rückbildung|schwangeren|babymassage|stillgruppe|sprachcaf|englisch für|deutsch für|deutschkurs|nachhilfe|infoabend|informationsabend|elternabend|jahreshauptversammlung|generalversammlung|anonyme alkoholiker)\w*|beratung/i;

/** true = Titel klingt nach Kurs/Beratung/Sitzung → nicht sammeln. „Beratung“ auch mitten im Wort (Berufsberatung, Mutterberatung). */
export function nichtSammeln(titel: string): boolean {
  return NICHT_SAMMELN.test(titel);
}
