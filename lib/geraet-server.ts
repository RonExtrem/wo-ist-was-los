import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { sql } from "./db";

/** Spittal an der Drau – vorab eingestellter Wohnort (Überraschung für Papa). */
export const STANDARD_WOHNORT = { name: "Spittal an der Drau", lat: 46.7989, lng: 13.4955 };

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Neues Gerät anlegen. Liefert den geheimen Token (nur einmal sichtbar, gespeichert wird der Hash). */
export async function neuesGeraet(): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const db = sql();
  const rows = (await db.query("INSERT INTO geraete (token_hash) VALUES ($1) RETURNING id", [hashToken(token)])) as { id: string }[];
  await db.query(
    `INSERT INTO einstellungen (geraet_id, wohnort_name, wohnort, interessen)
     VALUES ($1, $2, ST_SetSRID(ST_MakePoint($4, $3), 4326)::geography, $5)`,
    [rows[0].id, STANDARD_WOHNORT.name, STANDARD_WOHNORT.lat, STANDARD_WOHNORT.lng, ["messen-maerkte", "schlager-volksmusik", "feste-brauchtum", "kulinarik-wein"]]
  );
  return token;
}

/** Geräte-ID aus dem Header „x-geraet“ (oder null). */
export async function geraetAusAnfrage(req: Request): Promise<string | null> {
  const token = req.headers.get("x-geraet");
  if (!token || token.length < 20 || token.length > 100) return null;
  const rows = (await sql().query(
    "UPDATE geraete SET zuletzt_aktiv = now() WHERE token_hash = $1 RETURNING id",
    [hashToken(token)]
  )) as { id: string }[];
  return rows[0]?.id ?? null;
}

export function nichtErlaubt() {
  return Response.json({ fehler: "Gerät unbekannt" }, { status: 401 });
}
