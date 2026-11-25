import "server-only";
import { neon } from "@neondatabase/serverless";

/** SQL-Zugriff für Server-Code (API-Routen). Die Datenbank ist nie direkt aus dem Browser erreichbar. */
export function sql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL ist nicht gesetzt.");
  return neon(url);
}
