"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ChevronRight, LoaderCircle } from "lucide-react";
import { useApp } from "@/lib/client/app-zustand";
import { useEvents } from "@/lib/client/use-events";
import { useStunde } from "@/lib/client/use-stunde";
import { aufStunde, useZahlen } from "@/lib/client/use-zahlen";
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
  /** null = wird noch geladen */
  events: EventKurz[] | null;
  alleLink: string;
  leerText: string;
}) {
  const { einstellungen } = useApp();
  return (
    <section data-tour="abschnitt" className="mt-9">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 className="font-titel text-[1.6rem] leading-tight">{titel}</h2>
          {untertitel && <p className="mt-0.5 text-[0.95rem] text-gedaempft">{untertitel}</p>}
        </div>
        {!!events?.length && (
          <Link href={alleLink} className="flex min-h-12 shrink-0 items-center gap-1 rounded-full px-3 font-semibold text-see hover:bg-see-zart">
            Alle <ChevronRight className="h-5 w-5" />
          </Link>
        )}
      </div>
      {events == null ? (
        <div className="flex items-center justify-center gap-3 rounded-3xl bg-flaeche-2 px-5 py-6 text-gedaempft">
          <LoaderCircle className="h-6 w-6 animate-spin" /> Wird geladen …
        </div>
      ) : events.length ? (
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
  const weit = Math.max(umkreis, 150);
  const interessen = einstellungen.interessen;
  const stunde = useStunde(); // rechnet „Heute & morgen" usw. neu, wenn die App über Nacht offen blieb

  // Je Abschnitt eine eigene kleine Abfrage. Früher war es eine große, die bei vielen Veranstaltungen
  // nach 400 abgeschnitten wurde (spätere Messen fehlten, Länder-Zahlen stimmten nicht).
  const abfragen = useMemo(() => {
    if (!bereit || !stunde) return null;
    const basis = { lat: startpunkt.lat, lng: startpunkt.lng };
    const dreiMonate = zeitfenster("drei-monate");
    return {
      heuteMorgen: { ...basis, radius: umkreis, ...zeitfenster("heute-morgen"), max: 60 },
      wochenende: { ...basis, radius: umkreis, ...zeitfenster("wochenende"), max: 60 },
      fuerDich: interessen.length ? { ...basis, radius: umkreis, ...zeitfenster("monat"), kat: interessen, max: 60 } : null,
      messen: { ...basis, radius: weit, ...dreiMonate, kat: ["messen-maerkte"], max: 400 },
      zahlen: {
        von: aufStunde(dreiMonate.von),
        bis: aufStunde(dreiMonate.bis),
        lat: String(startpunkt.lat),
        lng: String(startpunkt.lng),
        radius: String(weit),
      },
    };
  }, [bereit, stunde, startpunkt.lat, startpunkt.lng, umkreis, weit, interessen]);

  const heuteMorgen = useEvents(abfragen?.heuteMorgen ?? null);
  const wochenende = useEvents(abfragen?.wochenende ?? null);
  const fuerDich = useEvents(abfragen?.fuerDich ?? null);
  const messen = useEvents(abfragen?.messen ?? null);
  const laender = useZahlen(abfragen?.zahlen ?? null);

  const nurMessen = useMemo(() => messen.events?.filter((e) => /messe/i.test(e.titel)) ?? null, [messen.events]);
  const fehler = heuteMorgen.fehler ?? wochenende.fehler ?? fuerDich.fehler ?? messen.fehler;
  const katParam = interessen.join(",");

  return (
    <main className="flex flex-1 flex-col">
      <WeissenseeKopf kinder={<div className="mt-6"><StartpunktWahl hell /></div>} />

      <div className="relative mx-auto -mt-12 w-full max-w-xl px-5">
        <div className="rounded-3xl bg-flaeche px-5 py-4 shadow-karte ring-1 ring-linie">
          <p className="text-[0.95rem] text-gedaempft">
            Umkreis <strong className="text-foreground">{umkreis} km</strong> um <strong className="text-foreground">{startpunkt.name}</strong>
          </p>
          {bereit && (
            <div data-tour="laender" className="mt-3 grid grid-cols-3 gap-2">
              {(["AT", "SI", "IT"] as const).map((l) => (
                <Link
                  key={l}
                  href={`/suchen?land=${l}&radius=${weit}&zeit=drei-monate`}
                  className="flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-2xl bg-flaeche-2 px-1 py-2 text-center text-[0.95rem] font-semibold leading-tight hover:bg-see-zart"
                >
                  <span aria-hidden className="text-xl leading-none">{LAENDER[l].flagge}</span>
                  <span>{LAENDER[l].name}</span>
                  <span className="min-h-[1.2em] text-[0.85rem] font-normal text-gedaempft">{laender ? (laender[l] ?? 0) : "…"}</span>
                </Link>
              ))}
            </div>
          )}
          <div data-tour="ansicht" className="mt-3">
            <AnsichtWahl className="w-full" />
          </div>
        </div>

        {!bereit ? (
          <div className="flex flex-col items-center gap-3 py-16 text-gedaempft">
            <LoaderCircle className="h-8 w-8 animate-spin" />
            Veranstaltungen werden geladen …
          </div>
        ) : (
          <>
            {fehler && <p className="mt-8 rounded-3xl bg-abendsonne-zart p-5 text-abendsonne">{fehler}</p>}
            <Abschnitt
              titel="Heute & morgen"
              untertitel="in deiner Nähe"
              events={heuteMorgen.events}
              alleLink="/suchen?zeit=heute-morgen"
              leerText="Heute und morgen ist in deinem Umkreis nichts eingetragen. Schau beim Wochenende vorbei!"
            />
            <Abschnitt
              titel="Dieses Wochenende"
              events={wochenende.events}
              alleLink="/suchen?zeit=wochenende"
              leerText="Fürs Wochenende ist in deinem Umkreis noch nichts eingetragen."
            />
            <Abschnitt
              titel="Für dich"
              untertitel="Passend zu deinen Interessen, nächste 30 Tage"
              events={interessen.length ? fuerDich.events : []}
              alleLink={`/suchen?zeit=monat&kat=${katParam}`}
              leerText="Gerade nichts Passendes zu deinen Interessen. In den Einstellungen kannst du sie ändern."
            />
            <Abschnitt
              titel="Bald: Messen"
              untertitel={`bis ${weit} km, nächste 3 Monate`}
              events={nurMessen}
              alleLink={`/suchen?kat=messen-maerkte&zeit=drei-monate&radius=${weit}`}
              leerText="In den nächsten 3 Monaten sind keine Messen eingetragen."
            />
          </>
        )}
      </div>
    </main>
  );
}
