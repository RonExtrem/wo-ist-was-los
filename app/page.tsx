"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ChevronRight, LoaderCircle } from "lucide-react";
import { useApp } from "@/lib/client/app-zustand";
import { useEvents } from "@/lib/client/use-events";
import { WeissenseeKopf } from "@/components/WeissenseeKopf";
import { StartpunktWahl } from "@/components/StartpunktWahl";
import { EventKarte } from "@/components/EventKarte";
import { zeitfenster } from "@/lib/datum";
import { LAENDER, type EventKurz } from "@/lib/event-typ";

function Abschnitt({
  titel,
  untertitel,
  events,
  alleLink,
  leerText,
}: {
  titel: string;
  untertitel?: string;
  events: EventKurz[];
  alleLink: string;
  leerText: string;
}) {
  return (
    <section className="mt-9">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 className="font-titel text-[1.6rem] leading-tight">{titel}</h2>
          {untertitel && <p className="mt-0.5 text-[0.95rem] text-gedaempft">{untertitel}</p>}
        </div>
        {events.length > 0 && (
          <Link href={alleLink} className="flex min-h-12 shrink-0 items-center gap-1 rounded-full px-3 font-semibold text-see hover:bg-see-zart">
            Alle <ChevronRight className="h-5 w-5" />
          </Link>
        )}
      </div>
      {events.length ? (
        <ul className="flex flex-col gap-3">
          {events.slice(0, 3).map((e, i) => (
            <EventKarte key={e.id} event={e} index={i} />
          ))}
        </ul>
      ) : (
        <p className="rounded-3xl bg-flaeche-2 px-5 py-6 text-center text-gedaempft">{leerText}</p>
      )}
    </section>
  );
}

export default function Startseite() {
  const { bereit, startpunkt, einstellungen } = useApp();
  const umkreis = einstellungen.umkreisKm;

  // Eine Abfrage für alles: 3 Monate, bis 150 km (bzw. eigener Umkreis, falls größer)
  const abfrage = useMemo(() => {
    if (!bereit) return null;
    const { von, bis } = zeitfenster("drei-monate");
    return { lat: startpunkt.lat, lng: startpunkt.lng, radius: Math.max(umkreis, 150), von, bis };
  }, [bereit, startpunkt.lat, startpunkt.lng, umkreis]);
  const { events, fehler, laedt } = useEvents(abfrage);

  const teile = useMemo(() => {
    if (!events) return null;
    const imUmkreis = (e: EventKurz) => (e.entfernungKm ?? 0) <= umkreis;
    const zwischen = (e: EventKurz, f: { von: Date; bis: Date }) => new Date(e.ende ?? e.beginn) >= f.von && new Date(e.beginn) <= f.bis;
    const hm = zeitfenster("heute-morgen");
    const we = zeitfenster("wochenende");
    const monat = zeitfenster("monat");
    const interessen = new Set(einstellungen.interessen);
    const laender = { AT: 0, SI: 0, IT: 0 } as Record<string, number>;
    events.forEach((e) => (laender[e.land] = (laender[e.land] ?? 0) + 1));
    return {
      heuteMorgen: events.filter((e) => imUmkreis(e) && zwischen(e, hm)),
      wochenende: events.filter((e) => imUmkreis(e) && zwischen(e, we)),
      fuerDich: events.filter((e) => imUmkreis(e) && zwischen(e, monat) && e.kategorien.some((k) => interessen.has(k))),
      messen: events.filter((e) => e.kategorien.includes("messen-maerkte") && /messe/i.test(e.titel)),
      laender,
    };
  }, [events, umkreis, einstellungen.interessen]);

  const katParam = einstellungen.interessen.join(",");

  return (
    <main className="flex flex-1 flex-col">
      <WeissenseeKopf kinder={<div className="mt-6"><StartpunktWahl hell /></div>} />

      <div className="relative mx-auto -mt-12 w-full max-w-xl px-5">
        <div className="rounded-3xl bg-flaeche px-5 py-4 shadow-karte ring-1 ring-linie">
          <p className="text-[0.95rem] text-gedaempft">
            Umkreis <strong className="text-foreground">{umkreis} km</strong> um <strong className="text-foreground">{startpunkt.name}</strong>
          </p>
          {teile && (
            <div className="ohne-balken -mx-1 mt-3 flex gap-2 overflow-x-auto px-1">
              {(["AT", "SI", "IT"] as const).map((l) => (
                <Link
                  key={l}
                  href={`/suchen?land=${l}&radius=150&zeit=drei-monate`}
                  className="flex min-h-12 items-center gap-2 whitespace-nowrap rounded-full bg-flaeche-2 px-4 font-semibold hover:bg-see-zart"
                >
                  <span aria-hidden>{LAENDER[l].flagge}</span> {LAENDER[l].name}
                  <span className="rounded-full bg-flaeche px-2 text-[0.85rem] text-gedaempft">{teile.laender[l] ?? 0}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {(laedt && !events) || !bereit ? (
          <div className="flex flex-col items-center gap-3 py-16 text-gedaempft">
            <LoaderCircle className="h-8 w-8 animate-spin" />
            Veranstaltungen werden geladen …
          </div>
        ) : fehler ? (
          <p className="mt-8 rounded-3xl bg-abendsonne-zart p-5 text-abendsonne">{fehler}</p>
        ) : teile ? (
          <>
            <Abschnitt
              titel="Heute & morgen"
              untertitel="in deiner Nähe"
              events={teile.heuteMorgen}
              alleLink="/suchen?zeit=heute-morgen"
              leerText="Heute und morgen ist in deinem Umkreis nichts eingetragen. Schau beim Wochenende vorbei!"
            />
            <Abschnitt
              titel="Dieses Wochenende"
              events={teile.wochenende}
              alleLink="/suchen?zeit=wochenende"
              leerText="Fürs Wochenende ist in deinem Umkreis noch nichts eingetragen."
            />
            <Abschnitt
              titel="Für dich"
              untertitel="Passend zu deinen Interessen, nächste 30 Tage"
              events={teile.fuerDich}
              alleLink={`/suchen?zeit=monat&kat=${katParam}`}
              leerText="Gerade nichts Passendes zu deinen Interessen. In den Einstellungen kannst du sie ändern."
            />
            <Abschnitt
              titel="Bald: Messen"
              untertitel="bis 150 km, nächste 3 Monate"
              events={teile.messen}
              alleLink="/suchen?kat=messen-maerkte&zeit=drei-monate&radius=150"
              leerText="In den nächsten 3 Monaten sind keine Messen eingetragen."
            />
          </>
        ) : null}
      </div>
    </main>
  );
}
