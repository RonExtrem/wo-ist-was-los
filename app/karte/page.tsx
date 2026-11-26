"use client";

import { useCallback, useMemo, useState } from "react";
import { LoaderCircle, X } from "lucide-react";
import { useApp } from "@/lib/client/app-zustand";
import { useEvents } from "@/lib/client/use-events";
import { KartenAnsicht } from "@/components/KartenAnsicht";
import { EventKarte } from "@/components/EventKarte";
import { zeitfenster } from "@/lib/datum";

const ZEITEN = [
  { id: "heute-morgen", text: "Heute & morgen" },
  { id: "wochenende", text: "Wochenende" },
  { id: "monat", text: "30 Tage" },
  { id: "drei-monate", text: "3 Monate" },
] as const;
type ZeitId = (typeof ZEITEN)[number]["id"];
const UMKREISE = [25, 50, 100, 150] as const;

function Chip({ an, onClick, children }: { an: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={an}
      onClick={onClick}
      className={`flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-full px-4 text-[0.95rem] font-semibold shadow-md transition-colors ${
        an ? "bg-see text-white" : "bg-flaeche/95 text-foreground ring-1 ring-linie backdrop-blur"
      }`}
    >
      {children}
    </button>
  );
}

export default function KartenSeite() {
  const { bereit, startpunkt, einstellungen } = useApp();
  const [zeit, setZeit] = useState<ZeitId>("monat");
  const [umkreisWahl, setUmkreis] = useState<number | null>(null);
  const umkreis = umkreisWahl ?? einstellungen.umkreisKm;
  const [auswahl, setAuswahl] = useState<string[]>([]);

  const abfrage = useMemo(() => {
    if (!bereit) return null;
    const { von, bis } = zeitfenster(zeit);
    return { lat: startpunkt.lat, lng: startpunkt.lng, radius: umkreis, von, bis };
  }, [bereit, startpunkt.lat, startpunkt.lng, umkreis, zeit]);
  const { events, laedt } = useEvents(abfrage);

  const liste = useMemo(() => events ?? [], [events]);
  const gewaehlt = useMemo(() => {
    const ids = new Set(auswahl);
    return liste.filter((e) => ids.has(e.id)).sort((a, b) => a.beginn.localeCompare(b.beginn));
  }, [liste, auswahl]);
  const mitte = useMemo(() => ({ lat: startpunkt.lat, lng: startpunkt.lng, name: startpunkt.name }), [startpunkt.lat, startpunkt.lng, startpunkt.name]);
  const waehle = useCallback((ids: string[]) => setAuswahl(ids), []);

  return (
    <main className="fixed inset-x-0 top-0 overflow-hidden" style={{ bottom: "calc(4.25rem + env(safe-area-inset-bottom))" }}>
      {bereit && <KartenAnsicht events={liste} mitte={mitte} umkreisKm={umkreis} onAuswahl={waehle} />}

      {/* Filter oben über der Karte */}
      <div className="pointer-events-none absolute inset-x-0 top-0 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
        <div className="ohne-balken pointer-events-auto flex gap-2 overflow-x-auto px-4 pb-1">
          {ZEITEN.map((z) => (
            <Chip key={z.id} an={zeit === z.id} onClick={() => { setZeit(z.id); setAuswahl([]); }}>
              {z.text}
            </Chip>
          ))}
        </div>
        <div className="ohne-balken pointer-events-auto mt-2 flex gap-2 overflow-x-auto px-4 pb-1">
          {UMKREISE.map((u) => (
            <Chip key={u} an={umkreis === u} onClick={() => { setUmkreis(u); setAuswahl([]); }}>
              {u} km
            </Chip>
          ))}
        </div>
        <p className="mx-4 mt-2 inline-flex items-center gap-2 rounded-full bg-flaeche/95 px-3 py-1.5 text-[0.9rem] font-semibold shadow-md ring-1 ring-linie backdrop-blur">
          {laedt || !events ? (
            <>
              <LoaderCircle className="h-4 w-4 animate-spin" /> Wird geladen …
            </>
          ) : (
            `${liste.length} Veranstaltungen um ${startpunkt.name}`
          )}
        </p>
      </div>

      {/* Ausgewählte Veranstaltung(en) unten */}
      {gewaehlt.length > 0 && (
        <div className="absolute inset-x-0 bottom-0 z-10 max-h-[55%] overflow-y-auto rounded-t-3xl bg-background/97 px-4 pb-4 pt-2 shadow-[0_-8px_30px_rgba(0,0,0,0.18)] backdrop-blur">
          <div className="sticky top-0 z-10 -mx-4 flex items-center justify-between bg-background/97 px-4 py-2">
            <p className="font-titel text-lg">
              {gewaehlt.length === 1 ? "Hier ist was los" : `${gewaehlt.length} Veranstaltungen hier`}
            </p>
            <button
              type="button"
              onClick={() => setAuswahl([])}
              aria-label="Schließen"
              className="flex h-12 w-12 items-center justify-center rounded-full bg-flaeche-2"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          <ul className="flex flex-col gap-2">
            {gewaehlt.map((e, i) => (
              <EventKarte key={e.id} event={e} index={i} ansicht="liste" />
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}
