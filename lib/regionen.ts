// Bundesländer bzw. Regionen pro Land – für den Filter „Wo?“ in der Suche.
// `db` = so steht die Region in der Datenbank (manche Quellen schreiben es unterschiedlich).

export interface Region {
  id: string;
  name: string;
  db: string[];
}

export const REGIONEN: Record<string, { titel: string; liste: Region[] }> = {
  AT: {
    titel: "Bundesländer",
    liste: [
      { id: "Kärnten", name: "Kärnten", db: ["Kärnten"] },
      { id: "Steiermark", name: "Steiermark", db: ["Steiermark"] },
      { id: "Tirol", name: "Tirol & Osttirol", db: ["Tirol"] },
      { id: "Salzburg", name: "Salzburg", db: ["Salzburg"] },
      { id: "Oberösterreich", name: "Oberösterreich", db: ["Oberösterreich"] },
      { id: "Niederösterreich", name: "Niederösterreich", db: ["Niederösterreich"] },
      { id: "Wien", name: "Wien", db: ["Wien"] },
      { id: "Burgenland", name: "Burgenland", db: ["Burgenland"] },
      { id: "Vorarlberg", name: "Vorarlberg", db: ["Vorarlberg"] },
    ],
  },
  IT: {
    titel: "Regionen",
    liste: [
      { id: "Südtirol", name: "Südtirol", db: ["Südtirol", "Trentino-Südtirol"] },
      { id: "Friaul-Julisch Venetien", name: "Friaul", db: ["Friaul-Julisch Venetien"] },
      { id: "Venetien", name: "Belluno & Cortina", db: ["Venetien"] },
    ],
  },
  SI: {
    titel: "Regionen",
    liste: [
      { id: "Oberkrain", name: "Oberkrain", db: ["Oberkrain"] },
      { id: "Slowenisch-Kärnten", name: "Slowenisch-Kärnten", db: ["Slowenisch-Kärnten"] },
    ],
  },
};

/** Zu welchem Land gehört eine Region-ID? */
export function landVonRegion(id: string): string | null {
  for (const [land, r] of Object.entries(REGIONEN)) if (r.liste.some((x) => x.id === id)) return land;
  return null;
}

/** Region-IDs → Datenbank-Namen und die Länder, die dadurch eingeschränkt sind. */
export function regionenAufloesen(ids: string[]): { db: string[]; laender: string[] } {
  const db: string[] = [];
  const laender = new Set<string>();
  for (const [land, r] of Object.entries(REGIONEN)) {
    for (const x of r.liste) {
      if (ids.includes(x.id)) {
        db.push(...x.db);
        laender.add(land);
      }
    }
  }
  return { db, laender: [...laender] };
}

/** Datenbank-Name → Region-ID (für die Zahlen). */
export function regionId(land: string, dbName: string | null): string | null {
  if (!dbName) return null;
  return REGIONEN[land]?.liste.find((x) => x.db.includes(dbName))?.id ?? null;
}
