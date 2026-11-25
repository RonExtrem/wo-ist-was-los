// Höfliches Abrufen: eigene Kennung, Wartezeit pro Server, robots.txt beachten, Wiederholung bei Fehlern.

export const KENNUNG = "Mozilla/5.0 (compatible; WoIsWosLos-Eventsammler/0.1; private Familien-App)";

const letzterAbruf = new Map<string, number>();
const robotsCache = new Map<string, string[]>();

const warte = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function verbotenePfadeFuer(origin: string): Promise<string[]> {
  if (robotsCache.has(origin)) return robotsCache.get(origin)!;
  let verboten: string[] = [];
  try {
    const res = await fetch(`${origin}/robots.txt`, { headers: { "User-Agent": KENNUNG }, signal: AbortSignal.timeout(15_000) });
    if (res.ok) {
      const text = await res.text();
      // Nur der Block für „*“ ist für uns relevant
      let imStern = false;
      for (const zeile of text.split(/\r?\n/)) {
        const [schluessel, ...rest] = zeile.split(":");
        const wert = rest.join(":").trim();
        const k = schluessel.trim().toLowerCase();
        if (k === "user-agent") imStern = wert === "*";
        else if (imStern && k === "disallow" && wert) verboten.push(wert);
      }
    }
  } catch {
    verboten = [];
  }
  robotsCache.set(origin, verboten);
  return verboten;
}

function passt(pfad: string, regel: string): boolean {
  // einfache robots-Muster: * und $ am Ende
  const re = new RegExp("^" + regel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\\\*/g, ".*").replace(/\\\$$/, "$"));
  return re.test(pfad);
}

export async function erlaubt(url: string): Promise<boolean> {
  const u = new URL(url);
  const regeln = await verbotenePfadeFuer(u.origin);
  const pfad = u.pathname + u.search;
  return !regeln.some((r) => passt(pfad, r));
}

/** Text einer Seite holen – mit mindestens `abstandMs` zwischen zwei Abrufen beim selben Server. */
export async function holeText(url: string, abstandMs = 1200): Promise<string> {
  if (!(await erlaubt(url))) throw new Error(`robots.txt verbietet ${url}`);
  const host = new URL(url).host;
  const seit = Date.now() - (letzterAbruf.get(host) ?? 0);
  if (seit < abstandMs) await warte(abstandMs - seit);

  let letzterFehler: unknown;
  for (let versuch = 1; versuch <= 3; versuch++) {
    letzterAbruf.set(host, Date.now());
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": KENNUNG, "Accept-Language": "de-AT,de;q=0.9" },
        signal: AbortSignal.timeout(30_000),
      });
      if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
      if (!res.ok) throw new Error(`HTTP ${res.status} bei ${url}`);
      return await res.text();
    } catch (err) {
      letzterFehler = err;
      if (String(err).includes("HTTP 4") && !String(err).includes("429")) break;
      await warte(2000 * versuch);
    }
  }
  throw letzterFehler instanceof Error ? letzterFehler : new Error(String(letzterFehler));
}
