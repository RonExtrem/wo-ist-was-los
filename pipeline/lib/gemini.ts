// Gemini (Gratis-Stufe): strukturierte Antworten als JSON. Achtet auf Kontingent und Wartezeiten.

// Reihenfolge: das erste Modell, das antwortet, wird verwendet. (Google-Suche ist in der Gratis-Stufe NICHT verfügbar.)
const MODELLE = (process.env.GEMINI_MODELLE ?? "gemini-3.5-flash,gemini-3.5-flash-lite,gemini-3.1-flash-lite").split(",");
const MAX_AUFRUFE = Number(process.env.KI_MAX_AUFRUFE ?? 80);
const ABSTAND_MS = 4500; // höchstens ~13 Anfragen pro Minute

let aufrufe = 0;
let letzter = 0;
const warte = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function kiVerfuegbar(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

export function kiAufrufeBisher(): number {
  return aufrufe;
}

export class KiKontingentErschoepft extends Error {}

export async function kiJson<T>(prompt: string, schema: object): Promise<T> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY fehlt");
  if (aufrufe >= MAX_AUFRUFE) throw new KiKontingentErschoepft(`Höchstzahl von ${MAX_AUFRUFE} KI-Aufrufen pro Lauf erreicht`);

  let letzterFehler = "";
  for (const modell of MODELLE) {
    for (let versuch = 1; versuch <= 3; versuch++) {
      const seit = Date.now() - letzter;
      if (seit < ABSTAND_MS) await warte(ABSTAND_MS - seit);
      letzter = Date.now();
      aufrufe++;

      let res: Response;
      try {
        res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modell}:generateContent`, {
          method: "POST",
          headers: { "x-goog-api-key": key, "content-type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json", responseSchema: schema, temperature: 0.1 },
          }),
          signal: AbortSignal.timeout(90_000),
        });
      } catch (err) {
        // Zeitüberschreitung/Netzfehler → Modell ist überlastet, gleich das nächste probieren
        letzterFehler = `${modell}: ${(err as Error).message}`;
        break;
      }
      const daten = (await res.json().catch(() => ({}))) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
        error?: { message?: string };
      };
      if (res.ok) {
        const text = daten.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
        try {
          return JSON.parse(text) as T;
        } catch {
          letzterFehler = `${modell}: Antwort war kein gültiges JSON`;
          continue;
        }
      }
      letzterFehler = `${modell}: HTTP ${res.status} ${daten.error?.message?.slice(0, 120) ?? ""}`;
      if (res.status === 429) {
        // Minutenlimit → kurz warten; Tageslimit → nächstes Modell
        if (/per.?day|daily/i.test(daten.error?.message ?? "")) break;
        await warte(30_000 * versuch);
      } else if (res.status === 503 || res.status === 500) {
        await warte(10_000 * versuch);
      } else {
        break; // 400/404: dieses Modell taugt nicht, nächstes probieren
      }
    }
  }
  throw new Error(`KI nicht erreichbar – ${letzterFehler}`);
}
