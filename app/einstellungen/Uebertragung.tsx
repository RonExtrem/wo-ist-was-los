"use client";

import { useState } from "react";
import { Smartphone } from "lucide-react";
import { useApp, type Einstellungen } from "@/lib/client/app-zustand";

/** Handywechsel: Code am alten Handy anzeigen, am neuen eingeben. */
export function Uebertragung({ nurEingeben = false }: { nurEingeben?: boolean } = {}) {
  const { api, setzeEinstellungen } = useApp();
  const [code, setCode] = useState<string | null>(null);
  const [eingabe, setEingabe] = useState("");
  const [meldung, setMeldung] = useState<{ ok: boolean; text: string } | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  const zeigeCode = async () => {
    const r = await api("/api/uebertragung").then((x) => x.json()).catch(() => null);
    setCode(r?.code ?? "–");
  };

  const uebernehmen = async () => {
    setLaeuft(true);
    setMeldung(null);
    const res = await api("/api/uebertragung", { method: "POST", body: JSON.stringify({ code: eingabe }) }).catch(() => null);
    const d = (await res?.json().catch(() => null)) as { ok?: boolean; fehler?: string; einstellungen?: Partial<Einstellungen> } | null;
    setLaeuft(false);
    if (!res?.ok || !d?.ok) {
      setMeldung({ ok: false, text: d?.fehler ?? "Das hat nicht geklappt. Bitte nochmal probieren." });
      return;
    }
    setzeEinstellungen({ ...(d.einstellungen ?? {}), eingerichtet: true });
    setMeldung({ ok: true, text: "Übernommen! Die gemerkten Veranstaltungen sind gleich da." });
    setTimeout(() => window.location.reload(), 1500);
  };

  return (
    <div className="flex flex-col gap-4">
      {!nurEingeben && (
      <div className="rounded-2xl bg-flaeche-2 p-4">
        <p className="font-semibold">Am alten Handy</p>
        {code ? (
          <p className="mt-2">
            Dein Code: <strong className="font-titel text-2xl tracking-wider text-see">{code}</strong>
            <span className="block text-[0.9rem] text-gedaempft">14 Tage gültig. Am neuen Handy unten eingeben.</span>
          </p>
        ) : (
          <button type="button" onClick={zeigeCode} className="mt-2 flex min-h-12 items-center gap-2 rounded-full bg-flaeche px-4 font-semibold ring-1 ring-linie">
            <Smartphone className="h-5 w-5" /> Code anzeigen
          </button>
        )}
      </div>
      )}
      <div className="rounded-2xl bg-flaeche-2 p-4">
        <label htmlFor="code" className="font-semibold">
          {nurEingeben ? "Code vom alten Handy" : "Am neuen Handy: Code eingeben"}
        </label>
        <div className="mt-2 flex gap-2">
          <input
            id="code"
            value={eingabe}
            onChange={(ev) => setEingabe(ev.target.value)}
            placeholder="z. B. GAMS-482193"
            autoCapitalize="characters"
            autoComplete="off"
            className="h-12 min-w-0 flex-1 rounded-xl bg-flaeche px-3 text-lg uppercase ring-1 ring-linie outline-none focus:ring-2 focus:ring-see"
          />
          <button
            type="button"
            onClick={uebernehmen}
            disabled={laeuft || eingabe.trim().length < 6}
            className="min-h-12 rounded-xl bg-see px-4 font-bold text-white disabled:opacity-50"
          >
            Übernehmen
          </button>
        </div>
        {meldung && (
          <p className={`mt-2 font-semibold ${meldung.ok ? "text-laerche" : "text-abendsonne"}`} role="status">
            {meldung.text}
          </p>
        )}
      </div>
    </div>
  );
}
