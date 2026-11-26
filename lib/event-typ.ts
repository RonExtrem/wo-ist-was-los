// Gemeinsame Typen für Events (Server ↔ Browser)

export interface EventKurz {
  id: string;
  titel: string;
  kurzbeschreibung: string | null;
  beginn: string; // ISO
  ende: string | null;
  ganztaegig: boolean;
  ortName: string;
  land: "AT" | "SI" | "IT";
  region: string | null;
  kategorien: string[];
  gratis: boolean | null;
  bildUrl: string | null;
  sicherheit: "sicher" | "unsicher";
  status: "aktiv" | "geaendert" | "abgesagt" | "verschwunden";
  lat: number | null;
  lng: number | null;
  entfernungKm: number | null;
}

export interface EventDetail extends EventKurz {
  adresse: string | null;
  preisText: string | null;
  freiluft: boolean | null;
  originalsprache: string;
  links: { url: string; quelle: string | null }[];
}

export interface EventFilter {
  lat: number;
  lng: number;
  radiusKm: number | null; // null = alle
  von: string; // ISO
  bis: string; // ISO
  kategorien?: string[];
  laender?: string[];
  nurGratis?: boolean;
  suche?: string;
}

export const LAENDER: Record<string, { name: string; flagge: string }> = {
  AT: { name: "Österreich", flagge: "🇦🇹" },
  SI: { name: "Slowenien", flagge: "🇸🇮" },
  IT: { name: "Italien", flagge: "🇮🇹" },
};
