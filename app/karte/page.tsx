"use client";

import { useCallback, useMemo, useState } from "react";
import { LoaderCircle, X, Satellite, Map as KartenSymbol } from "lucide-react";
import { useApp } from "@/lib/client/app-zustand";
import { useEvents } from "@/lib/client/use-events";
import { KartenAnsicht } from "@/components/KartenAnsicht";
import { EventKarte } from "@/components/EventKarte";
import { zeitfenster } from "@/lib/datum";
import { KATEGORIEN } from "@/lib/kategorien";
import { KATEGORIE_ICON } from "@/components/KategorieBild";

// Kurze Namen für die Knöpfe über der Karte
const KURZ: Record<string, string> = {
  "messen-maerkte": "Messen & Märkte",
  "schlager-volksmusik": "Schlager",
  "feste-brauchtum": "Feste & Kirchtage",
  "kulinarik-wein": "Kulinarik",
  advent: "Advent & Christkindlmärkte",
  "pop-rock-party": "Party",
  "klassik-kultur": "Kultur",
  sport: "Sport",
  "familie-kinder": "Familie",
  "oldtimer-technik": "Oldtimer",
  "natur-ausfluege": "Natur",
  sonstiges: "Sonstiges",
};
const SATELLIT_SCHLUESSEL = "wiwl-karte-satellit";

const ZEITEN = [
  { id: "heute-morgen", text: "Heute & morgen" },
  { id: "wochenende", text: "Wochenende" },
  { id: "monat", text: "30 Tage" },
  { id: "drei-monate", text: "3 Monate" },
] as const;
type ZeitId = (typeof ZEITEN)[number]["id"];
const UMKREISE = [25, 50, 100, 150] as const;

function Chip({
  an,
  onClick,
  children,
  farbe,
}: {
  an: boolean;
  onClick: () => void;
  children: React.ReactNode;
  farbe?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={an}
      onClick={onClick}
      style={an && farbe ? { background: farbe } : undefined}
      className={`flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-4 text-[0.95rem] font-semibold shadow-md transition-colors ${
        an
          ? "bg-see text-white"
          : "bg-flaeche/95 text-foreground ring-1 ring-linie backdrop-blur"
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
  const [kategorien, setKategorien] = useState<string[]>([]);
  // Gemerkte Kartenart (der Knopf wird erst nach dem Laden gezeigt – kein Unterschied zum Server-Bild)
  const [satellit, setSatellit] = useState(() => {
    try {
      return (
        typeof window !== "undefined" &&
        localStorage.getItem(SATELLIT_SCHLUESSEL) === "1"
      );
    } catch {
      return false;
    }
  });
  const satellitUmschalten = () => {
    setSatellit((v) => {
      try {
        localStorage.setItem(SATELLIT_SCHLUESSEL, v ? "0" : "1");
      } catch {
        /* egal */
      }
      return !v;
    });
  };

  const abfrage = useMemo(() => {
    if (!bereit) return null;
    const { von, bis } = zeitfenster(zeit);
    return {
      lat: startpunkt.lat,
      lng: startpunkt.lng,
      radius: umkreis,
      von,
      bis,
    };
  }, [bereit, startpunkt.lat, startpunkt.lng, umkreis, zeit]);
  const { events, laedt } = useEvents(abfrage);

  const alle = useMemo(() => events ?? [], [events]);
  // Welche Kategorien kommen in diesem Zeitraum/Umkreis vor? (meiste zuerst)
  const vorhandene = useMemo(() => {
    const zahl = new Map<string, number>();
    for (const e of alle)
      for (const k of new Set(e.kategorien))
        zahl.set(k, (zahl.get(k) ?? 0) + 1);
    return KATEGORIEN.filter((k) => zahl.has(k.id))
      .map((k) => ({ ...k, anzahl: zahl.get(k.id)! }))
      .sort((a, b) => b.anzahl - a.anzahl);
  }, [alle]);
  const liste = useMemo(
    () =>
      kategorien.length
        ? alle.filter((e) => e.kategorien.some((k) => kategorien.includes(k)))
        : alle,
    [alle, kategorien],
  );
  const kategorieUmschalten = (id: string) => {
    setAuswahl([]);
    setKategorien((jetzt) =>
      jetzt.includes(id) ? jetzt.filter((k) => k !== id) : [...jetzt, id],
    );
  };
  const gewaehlt = useMemo(() => {
    const ids = new Set(auswahl);
    return liste
      .filter((e) => ids.has(e.id))
      .sort((a, b) => a.beginn.localeCompare(b.beginn));
  }, [liste, auswahl]);
  const mitte = useMemo(
    () => ({ lat: startpunkt.lat, lng: startpunkt.lng, name: startpunkt.name }),
    [startpunkt.lat, startpunkt.lng, startpunkt.name],
  );
  const waehle = useCallback((ids: string[]) => setAuswahl(ids), []);

  return (
    <main
      className="fixed inset-x-0 top-0 overflow-hidden"
      style={{ bottom: "calc(4.25rem + env(safe-area-inset-bottom))" }}
    >
      {bereit && (
        <KartenAnsicht
          events={liste}
          mitte={mitte}
          umkreisKm={umkreis}
          onAuswahl={waehle}
          satellit={satellit}
          bevorzugt={kategorien}
        />
      )}

      {/* Filter oben über der Karte */}
      <div className="pointer-events-none absolute inset-x-0 top-0 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
        <div className="ohne-balken pointer-events-auto flex gap-2 overflow-x-auto px-4 pb-1">
          {ZEITEN.map((z) => (
            <Chip
              key={z.id}
              an={zeit === z.id}
              onClick={() => {
                setZeit(z.id);
                setAuswahl([]);
              }}
            >
              {z.text}
            </Chip>
          ))}
        </div>
        <div className="ohne-balken pointer-events-auto mt-2 flex gap-2 overflow-x-auto px-4 pb-1">
          {UMKREISE.map((u) => (
            <Chip
              key={u}
              an={umkreis === u}
              onClick={() => {
                setUmkreis(u);
                setAuswahl([]);
              }}
            >
              {u} km
            </Chip>
          ))}
        </div>
        {vorhandene.length > 1 && (
          <div className="ohne-balken pointer-events-auto mt-2 flex gap-2 overflow-x-auto px-4 pb-1">
            <Chip
              an={kategorien.length === 0}
              onClick={() => {
                setKategorien([]);
                setAuswahl([]);
              }}
            >
              Alles
            </Chip>
            {vorhandene.map((k) => {
              const Icon = KATEGORIE_ICON[k.id];
              const an = kategorien.includes(k.id);
              return (
                <Chip
                  key={k.id}
                  an={an}
                  farbe={k.farbe}
                  onClick={() => kategorieUmschalten(k.id)}
                >
                  {Icon && (
                    <Icon
                      className="h-4 w-4"
                      style={an ? undefined : { color: k.farbe }}
                    />
                  )}
                  {KURZ[k.id] ?? k.name}
                  <span className={an ? "text-white/80" : "text-gedaempft"}>
                    {k.anzahl}
                  </span>
                </Chip>
              );
            })}
          </div>
        )}
        <p className="mx-4 mt-2 inline-flex items-center gap-2 rounded-full bg-flaeche/95 px-3 py-1.5 text-[0.9rem] font-semibold shadow-md ring-1 ring-linie backdrop-blur">
          {laedt || !events ? (
            <>
              <LoaderCircle className="h-4 w-4 animate-spin" /> Wird geladen …
            </>
          ) : (
            `${liste.length} ${kategorien.length ? "passende " : ""}Veranstaltungen um ${startpunkt.name}`
          )}
        </p>
      </div>

      {/* Umschalter Karte / Satellit */}
      {bereit && (
        <button
          type="button"
          onClick={satellitUmschalten}
          aria-label={
            satellit ? "Normale Karte zeigen" : "Satellitenbild zeigen"
          }
          className="absolute bottom-4 left-4 flex min-h-12 items-center gap-2 rounded-full bg-flaeche/95 px-4 text-[0.95rem] font-semibold text-foreground shadow-md ring-1 ring-linie backdrop-blur"
        >
          {satellit ? (
            <KartenSymbol className="h-5 w-5 text-see" />
          ) : (
            <Satellite className="h-5 w-5 text-see" />
          )}
          {satellit ? "Karte" : "Satellit"}
        </button>
      )}

      {/* Ausgewählte Veranstaltung(en) unten */}
      {gewaehlt.length > 0 && (
        <div className="absolute inset-x-0 bottom-0 z-10 max-h-[55%] overflow-y-auto rounded-t-3xl bg-background/97 px-4 pb-4 pt-2 shadow-[0_-8px_30px_rgba(0,0,0,0.18)] backdrop-blur">
          <div className="sticky top-0 z-10 -mx-4 flex items-center justify-between bg-background/97 px-4 py-2">
            <p className="font-titel text-lg">
              {gewaehlt.length === 1
                ? "Hier ist was los"
                : `${gewaehlt.length} Veranstaltungen hier`}
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
