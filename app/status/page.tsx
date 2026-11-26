"use client";

import { useCallback, useEffect, useState } from "react";
import { LoaderCircle, ShieldAlert, ShieldCheck } from "lucide-react";
import { useApp } from "@/lib/client/app-zustand";
import { ZurueckKnopf } from "../event/[id]/DetailAktionen";

interface Quelle {
  id: string;
  name: string;
  url: string;
  aktiv: boolean;
  letzter_lauf: string | null;
  gefunden_letzter_lauf: number | null;
  durchschnitt: string | null;
  schlechte_naechte: number;
  letzter_fehler: string | null;
}

interface Daten {
  quellen: Quelle[];
  laeufe: { gestartet: string; beendet: string | null }[];
  events: { kommend: number; gesamt: number };
  admin: boolean;
}

const zeit = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("de-AT", { timeZone: "Europe/Vienna", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso)) : "–";

function ampel(q: Quelle) {
  if (!q.aktiv) return { farbe: "bg-linie", text: "aus" };
  if (q.schlechte_naechte >= 2) return { farbe: "bg-red-500", text: "Problem" };
  if (q.schlechte_naechte === 1 || q.letzter_fehler) return { farbe: "bg-amber-400", text: "beobachten" };
  return { farbe: "bg-emerald-500", text: "gut" };
}

// Versteckte Wartungsseite für Michi: Wie gut laufen die Quellen?
export default function StatusSeite() {
  const { api, bereit } = useApp();
  const [d, setD] = useState<Daten | null>(null);

  const laden = useCallback(() => {
    api("/api/status")
      .then((r) => r.json())
      .then(setD)
      .catch(() => {});
  }, [api]);

  useEffect(() => {
    if (bereit) laden();
  }, [bereit, laden]);

  const adminUmschalten = async () => {
    await api("/api/status", { method: "POST", body: JSON.stringify({ an: !d?.admin }) });
    laden();
  };

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-5 pt-[calc(env(safe-area-inset-top)+1rem)]">
      <div className="flex items-center gap-3">
        <ZurueckKnopf />
        <h1 className="font-titel text-[2rem] leading-tight">Quellen-Status</h1>
      </div>
      {!d ? (
        <div className="flex items-center justify-center gap-3 py-16 text-gedaempft">
          <LoaderCircle className="h-7 w-7 animate-spin" /> Wird geladen …
        </div>
      ) : (
        <>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-3xl bg-flaeche p-4 ring-1 ring-linie">
              <p className="text-[0.9rem] text-gedaempft">Kommende Events</p>
              <p className="font-titel text-3xl">{d.events.kommend}</p>
            </div>
            <div className="rounded-3xl bg-flaeche p-4 ring-1 ring-linie">
              <p className="text-[0.9rem] text-gedaempft">Letzter Sammellauf</p>
              <p className="text-lg font-semibold">{zeit(d.laeufe[0]?.beendet ?? null)}</p>
              {d.laeufe[0] && !d.laeufe[0].beendet && <p className="text-[0.85rem] text-abendsonne">läuft oder abgebrochen</p>}
            </div>
          </div>

          <button
            type="button"
            onClick={adminUmschalten}
            className={`mt-4 flex min-h-14 w-full items-center gap-3 rounded-2xl px-4 text-left font-semibold ring-1 ${
              d.admin ? "bg-see-zart text-see ring-see" : "bg-flaeche ring-linie"
            }`}
          >
            {d.admin ? <ShieldCheck className="h-6 w-6" /> : <ShieldAlert className="h-6 w-6" />}
            {d.admin ? "Dieses Handy bekommt Warnungen (antippen zum Abschalten)" : "Warnungen an dieses Handy schicken"}
          </button>
          <p className="mt-1 px-1 text-[0.85rem] text-gedaempft">Nachricht kommt, wenn eine Quelle 2 Nächte lang kaum etwas liefert oder der Nachtlauf ausfällt.</p>

          <ul className="mt-5 flex flex-col gap-2 pb-6">
            {d.quellen.map((q) => {
              const a = ampel(q);
              return (
                <li key={q.id} className="rounded-2xl bg-flaeche p-4 ring-1 ring-linie">
                  <div className="flex items-center gap-3">
                    <span className={`h-4 w-4 shrink-0 rounded-full ${a.farbe}`} aria-label={a.text} />
                    <a href={q.url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate font-semibold">
                      {q.name}
                    </a>
                    <span className="shrink-0 text-[0.9rem] text-gedaempft">{a.text}</span>
                  </div>
                  <p className="mt-1 text-[0.9rem] text-gedaempft">
                    Zuletzt {zeit(q.letzter_lauf)} · {q.gefunden_letzter_lauf ?? "–"} gefunden (Schnitt {q.durchschnitt ?? "–"})
                  </p>
                  {q.letzter_fehler && <p className="mt-1 text-[0.85rem] text-abendsonne">{q.letzter_fehler.slice(0, 160)}</p>}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </main>
  );
}
