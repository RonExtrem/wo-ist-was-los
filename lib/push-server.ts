import "server-only";
import webpush from "web-push";
import { sql } from "./db";

// Öffentlicher Schlüssel ist nicht geheim – darf als Ersatz im Code stehen
export const VAPID_PUBLIC =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "BAMDut0mZno5jdheQApyowpxkT3U3g7aOGMuP6Ud3BHrOA179QE5lua5f7RsdWW4QshX6dXIaW4O4cb0wDreypA";

let eingerichtet = false;
export function pushBereit(): boolean {
  const privat = process.env.VAPID_PRIVATE_KEY;
  if (!privat) return false;
  if (!eingerichtet) {
    webpush.setVapidDetails("https://wo-ist-was-los.vercel.app", VAPID_PUBLIC, privat);
    eingerichtet = true;
  }
  return true;
}

export interface Nachricht {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

/** Schickt eine Nachricht an alle Handys eines Geräts. Liefert die Zahl der erfolgreichen Zustellungen. */
export async function sendePush(geraetId: string, n: Nachricht, art: string): Promise<number> {
  if (!pushBereit()) throw new Error("VAPID_PRIVATE_KEY fehlt");
  const db = sql();
  const abos = (await db.query("SELECT id, endpoint, p256dh, auth FROM push_abos WHERE geraet_id = $1", [geraetId])) as {
    id: number;
    endpoint: string;
    p256dh: string;
    auth: string;
  }[];
  let ok = 0;
  for (const a of abos) {
    try {
      await webpush.sendNotification(
        { endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } },
        JSON.stringify(n),
        { TTL: 6 * 3600, urgency: art === "erinnerung" || art === "aenderung" ? "high" : "normal" }
      );
      ok++;
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      // Abo gibt es nicht mehr (App gelöscht, Erlaubnis entzogen) → wegräumen
      if (status === 404 || status === 410) await db.query("DELETE FROM push_abos WHERE id = $1", [a.id]);
      else console.warn("Push fehlgeschlagen", status, (e as Error).message);
    }
  }
  if (ok) await db.query("INSERT INTO push_log (geraet_id, art, titel) VALUES ($1, $2, $3)", [geraetId, art, n.title.slice(0, 200)]);
  return ok;
}
