"use client";

import { GalleryVertical, LayoutGrid, List } from "lucide-react";
import { useApp, type Ansicht } from "@/lib/client/app-zustand";
import type { EventKurz } from "@/lib/event-typ";
import { EventKarte } from "./EventKarte";

const ANSICHTEN: { id: Ansicht; text: string; Icon: typeof List }[] = [
  { id: "gross", text: "Groß", Icon: GalleryVertical },
  { id: "kacheln", text: "Kacheln", Icon: LayoutGrid },
  { id: "liste", text: "Liste", Icon: List },
];

/** Wie viele Events die Startseite pro Abschnitt zeigt – kompakte Ansichten zeigen mehr. */
export const PRO_ABSCHNITT: Record<Ansicht, number> = { gross: 3, kacheln: 4, liste: 6 };

/** Umschalter Groß · Kacheln · Liste (wird gemerkt). */
export function AnsichtWahl({ className = "" }: { className?: string }) {
  const { einstellungen, setzeEinstellungen } = useApp();
  return (
    <div role="group" aria-label="Ansicht" className={`flex rounded-full bg-flaeche-2 p-1 ring-1 ring-linie ${className}`}>
      {ANSICHTEN.map(({ id, text, Icon }) => {
        const an = einstellungen.ansicht === id;
        return (
          <button
            key={id}
            type="button"
            aria-pressed={an}
            onClick={() => setzeEinstellungen({ ansicht: id })}
            className={`flex min-h-11 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-[0.9rem] font-semibold transition-colors ${
              an ? "bg-see text-white shadow" : "text-gedaempft hover:text-foreground"
            }`}
          >
            <Icon aria-hidden className="h-5 w-5" /> {text}
          </button>
        );
      })}
    </div>
  );
}

/** Liste von Events in der gewählten Ansicht. */
export function EventListe({ events, zeigeTag = true }: { events: EventKurz[]; zeigeTag?: boolean }) {
  const { einstellungen } = useApp();
  const ansicht = einstellungen.ansicht;
  const klasse = ansicht === "kacheln" ? "grid grid-cols-2 gap-3" : ansicht === "liste" ? "flex flex-col gap-2" : "flex flex-col gap-3";
  return (
    <ul className={klasse}>
      {events.map((e, i) => (
        <EventKarte key={e.id} event={e} index={i} zeigeTag={zeigeTag} ansicht={ansicht} />
      ))}
    </ul>
  );
}
