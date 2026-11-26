import "server-only";

// Gemini (Gratis-Stufe) für die App selbst – z. B. „Teilen an die App“. Erstes Modell, das antwortet, gewinnt.
// Hier zählt Tempo (Papa wartet): das schnelle „lite“-Modell zuerst.
const MODELLE = (process.env.GEMINI_MODELLE_APP ?? "gemini-3.5-flash-lite,gemini-3.5-flash,gemini-3.1-flash-lite").split(",");

export function kiBereit(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

export async function kiJson<T>(prompt: string, schema: object, gesamtMs = 45_000): Promise<T> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY fehlt");
  const ende = Date.now() + gesamtMs;
  let letzterFehler = "";
  for (const modell of MODELLE) {
    const rest = ende - Date.now();
    if (rest < 3000) break;
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modell}:generateContent`, {
        method: "POST",
        headers: { "x-goog-api-key": key, "content-type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json", responseSchema: schema, temperature: 0.1 },
        }),
        signal: AbortSignal.timeout(Math.min(rest, 25_000)),
      });
      const daten = (await res.json().catch(() => ({}))) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
        error?: { message?: string };
      };
      if (!res.ok) {
        letzterFehler = `${modell}: HTTP ${res.status} ${daten.error?.message?.slice(0, 100) ?? ""}`;
        continue;
      }
      const text = daten.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
      return JSON.parse(text) as T;
    } catch (e) {
      letzterFehler = `${modell}: ${(e as Error).message}`;
    }
  }
  throw new Error(`KI nicht erreichbar – ${letzterFehler}`);
}
