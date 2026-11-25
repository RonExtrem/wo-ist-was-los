import type { KategorieId } from "../lib/kategorien.ts";

/** Ein Event, wie es ein Ausleseprogramm liefert – noch ohne Koordinaten und ohne Doppelte-Prüfung. */
export interface RohEvent {
  quelleId: string;
  url: string; // Link zur Originalseite
  titel: string;
  beschreibung?: string; // kurz, Deutsch
  originalsprache?: string; // 'de', 'sl', 'it' …
  beginn: Date;
  ende?: Date;
  ganztaegig: boolean;
  ortName: string;
  adresse?: string; // Straße, PLZ, Ort – für die Ortssuche
  land: "AT" | "SI" | "IT";
  region?: string;
  lat?: number;
  lng?: number;
  kategorien: KategorieId[];
  preisText?: string;
  gratis?: boolean;
  bildUrl?: string;
  freiluft?: boolean | null;
  sicherheit: "sicher" | "unsicher";
}

export interface QuellenErgebnis {
  events: RohEvent[];
  /** Hinweise für den Nachtbericht (z. B. übersprungene Einträge). */
  hinweise: string[];
}

export interface Quelle {
  id: string;
  name: string;
  url: string;
  art: "api" | "jsonld" | "html" | "ki";
  land: "AT" | "SI" | "IT";
  /** Bis zu wie vielen Tagen in die Zukunft die Quelle zuverlässig alles liefert (für „verschwunden“-Erkennung). */
  horizontTage: number;
  holen(kontext: Kontext): Promise<QuellenErgebnis>;
}

export interface Kontext {
  /** Höfliches Abrufen mit Wartezeit pro Server. */
  holeText(url: string): Promise<string>;
  log(text: string): void;
  /** URLs, die schon in der Datenbank stehen (zum Sparen von Detail-Abrufen). */
  bekannteUrls: Set<string>;
}
