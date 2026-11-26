"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ChevronRight, LoaderCircle } from "lucide-react";
import { useApp } from "@/lib/client/app-zustand";
import { useEvents } from "@/lib/client/use-events";
import { WeissenseeKopf } from "@/components/WeissenseeKopf";
import { StartpunktWahl } from "@/components/StartpunktWahl";
import { AnsichtWahl, EventListe, PRO_ABSCHNITT } from "@/components/EventListe";
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
  const { einstellungen } = useApp();
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
        <EventListe events={events.slice(0, PRO_ABSCHNITT[einstellungen.ansicht])} />
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
            <div className="mt-3 grid grid-cols-3 gap-2">
              {(["AT", "SI", "IT"] as const).map((l) => (
                <Link
                  key={l}
                  href={`/suchen?land=${l}&radius=150&zeit=drei-monate`}
                  className="flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-2xl bg-flaeche-2 px-1 py-2 text-center text-[0.95rem] font-semibold leading-tight hover:bg-see-zart"
                >
                  <span aria-hidden className="text-xl leading-none">{LAENDER[l].flagge}</span>
                  <span>{LAENDER[l].name}</span>
                  <span className="text-[0.85rem] font-normal text-gedaempft">{teile.laender[l] ?? 0}</span>
                </Link>
              ))}
            </div>
          )}
          <AnsichtWahl className="mt-3 w-full" />
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
