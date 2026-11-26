"use client";

// Suchfeld der Seite „Suchen“. Antippen öffnet einen eigenen Such-Bildschirm über die ganze Höhe:
// ab 2 Buchstaben erscheinen passende Veranstaltungen (Titel-Anfang zuerst) mit Trefferzahl.
// Beim Scrollen der Liste geht die Tastatur weg, die Treffer bleiben. Zurück-Taste schließt die Suche.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarDays, List, LoaderCircle, MapPin, Search, X } from "lucide-react";
import type { EventKurz } from "@/lib/event-typ";
import { tagText, zeitText } from "@/lib/datum";
import { KategorieBild } from "@/components/KategorieBild";

const MAX_LADEN = 500;
const MAX_ZEIGEN = 150;
const BEISPIELE = ["Advent", "Krampus", "Kirchtag", "Silvester", "Konzert", "Markt", "Schlager", "Fasching"];
const MARKE = "#suche";

function escape(t: string) {
  return t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Gefundenen Teil im Titel hervorheben. */
function Markiert({ text, suche }: { text: string; suche: string }) {
  const teile = text.split(new RegExp(`(${escape(suche)})`, "gi"));
  return (
    <>
      {teile.map((t, i) =>
        t.toLowerCase() === suche.toLowerCase() ? (
          <mark key={i} className="rounded bg-see-zart px-0.5 text-see">
            {t}
          </mark>
        ) : (
          <span key={i}>{t}</span>
        )
      )}
    </>
  );
}

export function SuchFeld({
  wert,
  suchen,
  lat,
  lng,
  radius,
}: {
  /** Aktuell angewendeter Suchbegriff */
  wert: string;
  /** Suchbegriff auf die Liste anwenden (leer = Suche löschen) */
  suchen: (text: string) => void;
  lat: number;
  lng: number;
  radius: number | "alle";
}) {
  const [text, setText] = useState(wert);
  const [offen, setOffen] = useState(false);
  const [vorschlaege, setVorschlaege] = useState<{ fuer: string; events: EventKurz[] } | null>(null);
  const [laedt, setLaedt] = useState(false);
  const eingabe = useRef<HTMLInputElement>(null);
  const nachDemSchliessen = useRef<(() => void) | null>(null);
  const sauber = text.trim();
  const genug = sauber.length >= 2;

  // Vorschläge laden (kurz warten, bis man fertig getippt hat; alte Anfragen abbrechen)
  useEffect(() => {
    if (!genug) return;
    const abbruch = new AbortController();
    const t = setTimeout(() => {
      setLaedt(true);
      const jetzt = new Date();
      const p = new URLSearchParams({
        lat: String(lat),
        lng: String(lng),
        radius: String(radius),
        von: jetzt.toISOString(),
        bis: new Date(jetzt.getTime() + 365 * 86_400_000).toISOString(),
        q: sauber,
        max: String(MAX_LADEN),
      });
      fetch(`/api/events?${p}`, { signal: abbruch.signal })
        .then((r) => r.json())
        .then((d: { events?: EventKurz[] }) => setVorschlaege({ fuer: sauber, events: d.events ?? [] }))
        .catch(() => !abbruch.signal.aborted && setVorschlaege({ fuer: sauber, events: [] }))
        .finally(() => !abbruch.signal.aborted && setLaedt(false));
    }, 250);
    return () => {
      clearTimeout(t);
      abbruch.abort();
    };
  }, [sauber, genug, lat, lng, radius]);

  // Sortieren: Titel beginnt mit dem Begriff → ein Wort im Titel beginnt so → Titel enthält ihn → nur Ort/Beschreibung
  const liste = useMemo(() => {
    if (!vorschlaege || !genug) return [];
    const wortAnfang = new RegExp(`(^|[^\\p{L}\\p{N}])${escape(vorschlaege.fuer)}`, "iu");
    const klein = vorschlaege.fuer.toLowerCase();
    const rang = (e: EventKurz) => {
      const t = e.titel.toLowerCase();
      if (t.startsWith(klein)) return 0;
      if (wortAnfang.test(e.titel)) return 1;
      if (t.includes(klein)) return 2;
      return 3;
    };
    return [...vorschlaege.events].sort((a, b) => rang(a) - rang(b) || a.beginn.localeCompare(b.beginn));
  }, [vorschlaege, genug]);

  // Such-Bildschirm öffnen: Eintrag im Verlauf, damit die Zurück-Taste ihn schließt
  const oeffnen = () => {
    if (offen) return;
    setOffen(true);
    if (window.location.hash !== MARKE) window.history.pushState(null, "", `${window.location.pathname}${window.location.search}${MARKE}`);
  };
  const schliessen = useCallback((danach?: () => void) => {
    eingabe.current?.blur();
    if (window.location.hash === MARKE) {
      nachDemSchliessen.current = danach ?? null;
      window.history.back(); // → popstate schließt
    } else {
      setOffen(false);
      danach?.();
    }
  }, []);
  useEffect(() => {
    const zurueck = () => {
      if (window.location.hash === MARKE) return;
      setOffen(false);
      const danach = nachDemSchliessen.current;
      nachDemSchliessen.current = null;
      danach?.();
    };
    window.addEventListener("popstate", zurueck);
    return () => window.removeEventListener("popstate", zurueck);
  }, []);

  const anwenden = (t: string) => schliessen(() => suchen(t.trim()));
  const aktuell = vorschlaege?.fuer === sauber;
  const anzahl = aktuell ? liste.length : null;
  const umkreisText = radius === "alle" ? "im ganzen Gebiet" : `bis ${radius} km`;

  return (
    <div
      className={
        offen
          ? "fixed inset-0 z-[60] flex flex-col bg-background"
          : "sticky top-0 z-30 -mx-5 mt-2 bg-background px-5 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)]"
      }
    >
      {/* Kopf: (im Such-Bildschirm mit Zurück-Pfeil) + Eingabefeld */}
      <div className={offen ? "flex items-center gap-2 border-b border-linie px-3 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)]" : ""}>
        {offen && (
          <button
            type="button"
            onClick={() => schliessen()}
            aria-label="Suche schließen"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-flaeche-2"
          >
            <ArrowLeft className="h-6 w-6" />
          </button>
        )}
        <form
          className="min-w-0 flex-1"
          onSubmit={(ev) => {
            ev.preventDefault();
            if (genug || !sauber) anwenden(text);
          }}
        >
          <label className="flex min-h-14 items-center gap-3 rounded-2xl bg-flaeche px-4 shadow-karte ring-1 ring-linie focus-within:ring-2 focus-within:ring-see">
            <Search aria-hidden className="h-6 w-6 shrink-0 text-gedaempft" />
            <input
              ref={eingabe}
              value={text}
              onChange={(ev) => setText(ev.target.value)}
              onFocus={oeffnen}
              placeholder="z. B. Kirchtag, Advent, Spittal …"
              aria-label="Suchbegriff"
              enterKeyHint="search"
              autoComplete="off"
              className="h-14 min-w-0 flex-1 bg-transparent text-lg outline-none placeholder:text-gedaempft"
            />
            {laedt && genug && <LoaderCircle className="h-5 w-5 shrink-0 animate-spin text-gedaempft" />}
            {text && (
              <button
                type="button"
                aria-label="Suchbegriff löschen"
                onClick={() => {
                  setText("");
                  setVorschlaege(null);
                  if (wert) suchen("");
                  eingabe.current?.focus();
                }}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-flaeche-2"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </label>
        </form>
      </div>

      {offen && (
        <div
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[calc(1rem+env(safe-area-inset-bottom))]"
          // Beim Wischen durch die Treffer geht die Tastatur weg – die Liste bleibt
          onTouchMove={() => eingabe.current?.blur()}
          onWheel={() => eingabe.current?.blur()}
        >
          {!genug ? (
            <div className="px-4 py-5">
              <p className="text-lg text-gedaempft">Tipp ein paar Buchstaben – schon beim Tippen erscheinen passende Veranstaltungen.</p>
              <p className="mt-5 text-[0.9rem] font-semibold text-gedaempft">Zum Beispiel:</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {BEISPIELE.map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setText(b)}
                    className="min-h-12 rounded-full bg-flaeche px-4 font-semibold ring-1 ring-linie hover:bg-see-zart"
                  >
                    {b}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {/* Trefferzahl + in die Liste übernehmen – bleibt beim Scrollen oben */}
              <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-linie bg-background/95 px-4 py-3 backdrop-blur">
                <p className="min-w-0 flex-1 leading-tight" aria-live="polite">
                  {anzahl == null ? (
                    <span className="flex items-center gap-2 text-gedaempft">
                      <LoaderCircle className="h-5 w-5 animate-spin" /> Wird gesucht …
                    </span>
                  ) : (
                    <>
                      <strong className="font-titel text-[1.35rem]">
                        {anzahl >= MAX_LADEN ? `über ${MAX_LADEN}` : anzahl} {anzahl === 1 ? "Treffer" : "Treffer"}
                      </strong>
                      <span className="block text-[0.88rem] text-gedaempft">nächste 12 Monate · {umkreisText}</span>
                    </>
                  )}
                </p>
                {!!anzahl && (
                  <button
                    type="button"
                    onClick={() => anwenden(sauber)}
                    className="flex min-h-12 shrink-0 items-center gap-2 rounded-full bg-see px-4 font-semibold text-white"
                  >
                    <List className="h-5 w-5" /> Als Liste
                  </button>
                )}
              </div>

              {anzahl === 0 && (
                <p className="px-4 py-5 text-lg text-gedaempft">
                  Nichts mit „{sauber}“ gefunden. Probier ein anderes Wort oder stell unter „Wie weit?“ einen größeren Umkreis ein.
                </p>
              )}
              {aktuell && (
                <ul>
                  {liste.slice(0, MAX_ZEIGEN).map((e) => (
                    <li key={e.id}>
                      <Link href={`/event/${e.id}`} className="flex items-center gap-3 border-b border-linie/60 px-4 py-3 hover:bg-flaeche-2">
                        <span className="h-12 w-12 shrink-0 overflow-hidden rounded-xl">
                          <KategorieBild kategorie={e.kategorien[0] ?? "sonstiges"} className="h-full w-full" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="line-clamp-2 text-[1.05rem] font-semibold leading-snug">
                            <Markiert text={e.titel} suche={sauber} />
                          </span>
                          <span className="mt-0.5 flex items-center gap-1 truncate text-[0.88rem] text-gedaempft">
                            <CalendarDays className="h-4 w-4 shrink-0" /> {tagText(e.beginn)} · {zeitText(e)}
                          </span>
                          <span className="flex items-center gap-1 text-[0.88rem] text-gedaempft">
                            <MapPin className="h-4 w-4 shrink-0" /> <span className="truncate">{e.ortName}</span>
                            {e.entfernungKm != null && <span className="shrink-0">· {Math.round(e.entfernungKm)} km</span>}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {aktuell && liste.length > MAX_ZEIGEN && (
                <button type="button" onClick={() => anwenden(sauber)} className="min-h-14 w-full px-4 text-left font-semibold text-see">
                  … und {liste.length - MAX_ZEIGEN} weitere – alle als Liste zeigen
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
