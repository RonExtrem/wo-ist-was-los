"use client";

import { useCallback, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  LoaderCircle,
  X,
  Satellite,
  Map as KartenSymbol,
  MapPin,
  ChevronDown,
  CircleDot,
  SlidersHorizontal,
  House,
  LocateFixed,
  Pointer,
  Check,
} from "lucide-react";
import { useApp } from "@/lib/client/app-zustand";
import { useEvents } from "@/lib/client/use-events";
import { KartenAnsicht } from "@/components/KartenAnsicht";
import { EventKarte } from "@/components/EventKarte";
import { OrtSuche } from "@/components/StartpunktWahl";
import { zeitfenster } from "@/lib/datum";
import { KATEGORIEN } from "@/lib/kategorien";
import { KATEGORIE_ICON } from "@/components/KategorieBild";

// Kurze Namen für die Auswahl über der Karte
const KURZ: Record<string, string> = {
  "messen-maerkte": "Messen & Märkte",
  "schlager-volksmusik": "Schlager & Volksmusik",
  "feste-brauchtum": "Feste & Kirchtage",
  "kulinarik-wein": "Kulinarik & Wein",
  advent: "Advent & Christkindlmärkte",
  "pop-rock-party": "Pop, Rock & Party",
  "klassik-kultur": "Kultur & Theater",
  sport: "Sport",
  "familie-kinder": "Familie & Kinder",
  "oldtimer-technik": "Oldtimer & Technik",
  "natur-ausfluege": "Natur & Ausflüge",
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
type Umkreis = number | "alle";
const UMKREISE: { wert: Umkreis; text: string }[] = [
  { wert: 10, text: "10 km" },
  { wert: 25, text: "25 km" },
  { wert: 50, text: "50 km" },
  { wert: 100, text: "100 km" },
  { wert: 150, text: "150 km" },
  { wert: 300, text: "300 km" },
  { wert: "alle", text: "Überall" },
];
type Blatt = "ort" | "umkreis" | "kategorien" | null;

function Chip({
  an,
  onClick,
  children,
}: {
  an: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={an}
      onClick={onClick}
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

/** Knopf mit Pfeil nach unten – öffnet eine Auswahl von unten. */
function AuswahlKnopf({
  onClick,
  children,
  aktiv = false,
  className = "",
}: {
  onClick: () => void;
  children: React.ReactNode;
  aktiv?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-12 min-w-0 items-center gap-1.5 rounded-full px-3.5 text-[0.95rem] font-semibold shadow-md transition-colors ${
        aktiv
          ? "bg-abendsonne text-white"
          : "bg-flaeche/95 text-foreground ring-1 ring-linie backdrop-blur"
      } ${className}`}
    >
      {children}
      <ChevronDown className="h-4 w-4 shrink-0 opacity-70" />
    </button>
  );
}

/** Fenster von unten (eigener Dialog, keine Browser-Popups). */
function UntenBlatt({
  offen,
  titel,
  schliessen,
  children,
  fuss,
}: {
  offen: boolean;
  titel: string;
  schliessen: () => void;
  children: React.ReactNode;
  fuss?: React.ReactNode;
}) {
  return (
    <AnimatePresence>
      {offen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            aria-label="Schließen"
            className="absolute inset-0 bg-black/45"
            onClick={schliessen}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={titel}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 36 }}
            className="relative flex max-h-[85vh] w-full max-w-xl flex-col rounded-t-[2rem] bg-flaeche p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-foreground shadow-2xl"
          >
            <div className="mx-auto mb-4 h-1.5 w-12 shrink-0 rounded-full bg-linie" />
            <div className="flex shrink-0 items-center justify-between">
              <h2 className="font-titel text-2xl">{titel}</h2>
              <button
                type="button"
                onClick={schliessen}
                aria-label="Schließen"
                className="flex h-12 w-12 items-center justify-center rounded-full bg-flaeche-2"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
              {children}
            </div>
            {fuss && <div className="mt-3 shrink-0">{fuss}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const zeile =
  "flex min-h-14 w-full items-center gap-3 rounded-2xl px-3 text-left text-lg font-semibold hover:bg-flaeche-2";

export default function KartenSeite() {
  const { bereit, startpunkt, setzeStartpunkt, einstellungen } = useApp();
  const [zeit, setZeit] = useState<ZeitId>("monat");
  const [umkreisWahl, setUmkreis] = useState<Umkreis | null>(null);
  const umkreis: Umkreis = umkreisWahl ?? einstellungen.umkreisKm;
  const [auswahl, setAuswahl] = useState<string[]>([]);
  const [kategorien, setKategorien] = useState<string[]>([]);
  const [blatt, setBlatt] = useState<Blatt>(null);
  const [punktWaehlen, setPunktWaehlen] = useState(false);
  const [ortet, setOrtet] = useState(false);
  const [hinweis, setHinweis] = useState<string | null>(null);
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
      max: 2500,
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

  // Punkt auf der Karte gewählt → dort suchen, Ortsname nachladen
  const kartenTipp = useCallback(
    (lat: number, lng: number) => {
      setPunktWaehlen(false);
      setAuswahl([]);
      setzeStartpunkt({ art: "anders", name: "Gewählter Punkt", lat, lng });
      fetch(`/api/ort?rueck=1&lat=${lat.toFixed(4)}&lng=${lng.toFixed(4)}`)
        .then((r) => r.json())
        .then((d: { name: string | null }) => {
          if (d.name)
            setzeStartpunkt({ art: "anders", name: d.name, lat, lng });
        })
        .catch(() => {});
    },
    [setzeStartpunkt],
  );

  const hier = () => {
    setHinweis(null);
    if (!("geolocation" in navigator)) {
      setHinweis("Dieses Handy kann den Standort nicht bestimmen.");
      return;
    }
    setOrtet(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setOrtet(false);
        setBlatt(null);
        setzeStartpunkt({
          art: "hier",
          name: "Mein Standort",
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      },
      () => {
        setOrtet(false);
        setHinweis(
          "Standort nicht verfügbar. Bitte in den Handy-Einstellungen den Standort für diese App erlauben.",
        );
      },
      { enableHighAccuracy: false, timeout: 12_000, maximumAge: 300_000 },
    );
  };

  const umkreisText =
    UMKREISE.find((u) => u.wert === umkreis)?.text ?? `${umkreis} km`;
  const kategorieText =
    kategorien.length === 0
      ? "Alle Arten"
      : kategorien.length === 1
        ? (KURZ[kategorien[0]] ?? "1 Art")
        : `${kategorien.length} Arten`;

  return (
    <>
      <main
        className="fixed inset-x-0 top-0 overflow-hidden"
        style={{ bottom: "calc(4.25rem + env(safe-area-inset-bottom))" }}
      >
        {bereit && (
          <KartenAnsicht
            events={liste}
            mitte={mitte}
            umkreisKm={umkreis === "alle" ? null : umkreis}
            onAuswahl={waehle}
            satellit={satellit}
            bevorzugt={kategorien}
            onKartenTipp={punktWaehlen ? kartenTipp : null}
          />
        )}

        {/* Filter oben über der Karte */}
        <div className="pointer-events-none absolute inset-x-0 top-0 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
          {punktWaehlen ? (
            <div className="pointer-events-auto mx-4 flex items-center gap-3 rounded-3xl bg-abendsonne p-3 pl-4 text-white shadow-lg">
              <Pointer className="h-6 w-6 shrink-0" />
              <p className="flex-1 text-[1.05rem] font-semibold leading-snug">
                Tippe auf die Stelle, um die herum gesucht werden soll.
              </p>
              <button
                type="button"
                onClick={() => setPunktWaehlen(false)}
                className="min-h-12 shrink-0 rounded-full bg-white/20 px-4 font-semibold"
              >
                Abbrechen
              </button>
            </div>
          ) : (
            <>
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
              <div className="pointer-events-auto mt-2 flex gap-2 px-4">
                <AuswahlKnopf
                  onClick={() => setBlatt("ort")}
                  className="flex-1"
                >
                  <MapPin className="h-5 w-5 shrink-0 text-see" />
                  <span className="truncate">{startpunkt.name}</span>
                </AuswahlKnopf>
                <AuswahlKnopf
                  onClick={() => setBlatt("umkreis")}
                  className="shrink-0"
                >
                  <CircleDot className="h-5 w-5 shrink-0 text-see" />
                  {umkreisText}
                </AuswahlKnopf>
              </div>
              <div className="pointer-events-auto mt-2 flex gap-2 px-4">
                <AuswahlKnopf
                  onClick={() => setBlatt("kategorien")}
                  aktiv={kategorien.length > 0}
                  className="max-w-full"
                >
                  <SlidersHorizontal
                    className={`h-5 w-5 shrink-0 ${kategorien.length ? "" : "text-see"}`}
                  />
                  <span className="truncate">{kategorieText}</span>
                </AuswahlKnopf>
              </div>
              <p className="mx-4 mt-2 inline-flex items-center gap-2 rounded-full bg-flaeche/95 px-3 py-1.5 text-[0.9rem] font-semibold shadow-md ring-1 ring-linie backdrop-blur">
                {laedt || !events ? (
                  <>
                    <LoaderCircle className="h-4 w-4 animate-spin" /> Wird
                    geladen …
                  </>
                ) : (
                  `${liste.length} ${kategorien.length ? "passende " : ""}Veranstaltungen`
                )}
              </p>
            </>
          )}
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

      {/* Auswahlfenster außerhalb der Karte, damit sie über der unteren Leiste liegen */}
      {/* Wo suchen? – Daheim, Standort, auf der Karte antippen oder Ort/PLZ eintippen */}
      <OrtSuche
        offen={blatt === "ort"}
        titel="Wo suchen?"
        autoFokus={false}
        schliessen={() => {
          setBlatt(null);
          setHinweis(null);
        }}
        gewaehlt={(o) => {
          setBlatt(null);
          setAuswahl([]);
          setzeStartpunkt({
            art: "anders",
            name: o.name,
            lat: o.lat,
            lng: o.lng,
          });
        }}
        oben={
          <div className="mt-3 flex flex-col gap-1">
            <button
              type="button"
              className={zeile}
              onClick={() => {
                setBlatt(null);
                setAuswahl([]);
                setzeStartpunkt({
                  art: "daheim",
                  name: einstellungen.wohnortName,
                  lat: einstellungen.lat,
                  lng: einstellungen.lng,
                });
              }}
            >
              <House className="h-6 w-6 shrink-0 text-see" /> Daheim ·{" "}
              {einstellungen.wohnortName}
            </button>
            <button type="button" className={zeile} onClick={hier}>
              {ortet ? (
                <LoaderCircle className="h-6 w-6 shrink-0 animate-spin text-see" />
              ) : (
                <LocateFixed className="h-6 w-6 shrink-0 text-see" />
              )}
              Wo ich gerade bin
            </button>
            <button
              type="button"
              className={zeile}
              onClick={() => {
                setBlatt(null);
                setAuswahl([]);
                setPunktWaehlen(true);
              }}
            >
              <Pointer className="h-6 w-6 shrink-0 text-see" /> Auf der Karte
              antippen
            </button>
            {hinweis && (
              <p className="rounded-2xl bg-abendsonne-zart px-3 py-2 text-[0.9rem] text-abendsonne">
                {hinweis}
              </p>
            )}
            <p className="mt-2 px-1 text-[0.95rem] font-semibold text-gedaempft">
              Oder Ort bzw. Postleitzahl eintippen:
            </p>
          </div>
        }
      />

      {/* Umkreis */}
      <UntenBlatt
        offen={blatt === "umkreis"}
        titel="Wie weit?"
        schliessen={() => setBlatt(null)}
      >
        <ul className="flex flex-col gap-1">
          {UMKREISE.map((u) => (
            <li key={String(u.wert)}>
              <button
                type="button"
                className={zeile}
                onClick={() => {
                  setUmkreis(u.wert);
                  setAuswahl([]);
                  setBlatt(null);
                }}
              >
                <span className="flex-1">
                  {u.text}
                  {u.wert === "alle" && (
                    <span className="block text-[0.9rem] font-normal text-gedaempft">
                      Ganz Österreich, Slowenien und Norditalien
                    </span>
                  )}
                </span>
                {umkreis === u.wert && <Check className="h-6 w-6 text-see" />}
              </button>
            </li>
          ))}
        </ul>
      </UntenBlatt>

      {/* Kategorien */}
      <UntenBlatt
        offen={blatt === "kategorien"}
        titel="Was interessiert dich?"
        schliessen={() => setBlatt(null)}
        fuss={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setKategorien([]);
                setAuswahl([]);
              }}
              className="min-h-14 flex-1 rounded-2xl bg-flaeche-2 text-lg font-semibold"
            >
              Alle zeigen
            </button>
            <button
              type="button"
              onClick={() => setBlatt(null)}
              className="min-h-14 flex-1 rounded-2xl bg-see text-lg font-semibold text-white"
            >
              Fertig
            </button>
          </div>
        }
      >
        {vorhandene.length === 0 && (
          <p className="px-3 py-4 text-gedaempft">
            Im gewählten Gebiet und Zeitraum gibt es gerade nichts.
          </p>
        )}
        <ul className="flex flex-col gap-1">
          {vorhandene.map((k) => {
            const Icon = KATEGORIE_ICON[k.id];
            const an = kategorien.includes(k.id);
            return (
              <li key={k.id}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={an}
                  className={zeile}
                  onClick={() => kategorieUmschalten(k.id)}
                >
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                    style={{
                      background: an
                        ? k.farbe
                        : `color-mix(in oklab, ${k.farbe} 15%, transparent)`,
                    }}
                  >
                    {Icon && (
                      <Icon
                        className="h-5 w-5"
                        style={{ color: an ? "#fff" : k.farbe }}
                      />
                    )}
                  </span>
                  <span className="flex-1">{KURZ[k.id] ?? k.name}</span>
                  <span className="text-[0.95rem] font-normal text-gedaempft">
                    {k.anzahl}
                  </span>
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 ${an ? "border-see bg-see text-white" : "border-linie"}`}
                  >
                    {an && <Check className="h-5 w-5" />}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </UntenBlatt>
    </>
  );
}
