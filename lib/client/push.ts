// Push-Nachrichten im Browser ein- und ausschalten.

const VAPID_PUBLIC =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "BAMDut0mZno5jdheQApyowpxkT3U3g7aOGMuP6Ud3BHrOA179QE5lua5f7RsdWW4QshX6dXIaW4O4cb0wDreypA";

export type PushStatus = "unbekannt" | "nicht-moeglich" | "aus" | "an" | "blockiert";

type Api = (pfad: string, init?: RequestInit) => Promise<Response>;

function schluesselAlsBytes(base64: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const roh = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(new ArrayBuffer(roh.length));
  for (let i = 0; i < roh.length; i++) bytes[i] = roh.charCodeAt(i);
  return bytes;
}

export function pushMoeglich(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export async function pushStatus(): Promise<PushStatus> {
  if (!pushMoeglich()) return "nicht-moeglich";
  if (Notification.permission === "denied") return "blockiert";
  const reg = await navigator.serviceWorker.getRegistration();
  const abo = await reg?.pushManager.getSubscription();
  return abo && Notification.permission === "granted" ? "an" : "aus";
}

/** Fragt nach der Erlaubnis, meldet das Handy beim Server an und zeigt eine Bestätigung. */
export async function pushEinschalten(api: Api): Promise<PushStatus> {
  if (!pushMoeglich()) return "nicht-moeglich";
  const erlaubnis = await Notification.requestPermission();
  if (erlaubnis !== "granted") return erlaubnis === "denied" ? "blockiert" : "aus";
  const reg = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register("/sw.js"));
  await navigator.serviceWorker.ready;
  const vorhanden = await reg.pushManager.getSubscription();
  const abo =
    vorhanden ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: schluesselAlsBytes(VAPID_PUBLIC) }));
  // Server muss das Abo kennen – sonst zeigt das Handy „an“, aber es kommt nie etwas
  const ok = await api("/api/push", { method: "POST", body: JSON.stringify(abo.toJSON()) })
    .then((r) => r.ok)
    .catch(() => false);
  if (!ok) {
    if (!vorhanden) await abo.unsubscribe().catch(() => {});
    return "aus";
  }
  await reg.showNotification("Benachrichtigungen sind an 👍", {
    body: "So sieht eine Erinnerung von „Wo is wos los?“ aus.",
    icon: "/icons/icon-192.png",
    badge: "/icons/badge-96.png",
    tag: "willkommen",
  });
  return "an";
}

/** Beim Start: vorhandenes Abo (Erlaubnis da) nochmal beim Server melden – heilt eine früher fehlgeschlagene Anmeldung. */
export async function pushAboErneuern(api: Api): Promise<void> {
  if (!pushMoeglich() || Notification.permission !== "granted") return;
  const reg = await navigator.serviceWorker.getRegistration();
  const abo = await reg?.pushManager.getSubscription();
  if (abo) await api("/api/push", { method: "POST", body: JSON.stringify(abo.toJSON()) });
}

export async function pushAusschalten(api: Api): Promise<PushStatus> {
  if (!pushMoeglich()) return "nicht-moeglich";
  const reg = await navigator.serviceWorker.getRegistration();
  const abo = await reg?.pushManager.getSubscription();
  if (abo) {
    await api("/api/push", { method: "DELETE", body: JSON.stringify({ endpoint: abo.endpoint }) }).catch(() => {});
    await abo.unsubscribe();
  }
  return "aus";
}
