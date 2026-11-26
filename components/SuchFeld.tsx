"use client";

// Suchfeld mit Vorschlägen schon beim Tippen: ab 2 Buchstaben passende Veranstaltungen (Wortanfang zuerst).
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CalendarDays, LoaderCircle, MapPin, Search, X } from "lucide-react";
import type { EventKurz } from "@/lib/event-typ";
import { tagText, zeitText } from "@/lib/datum";
import { KategorieBild } from "@/components/KategorieBild";

const MAX_ZEIGEN = 60;

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
        max: "300",
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

  // Sortieren: Titel beginnt ein Wort mit dem Begriff → Titel enthält ihn → nur Ort/Beschreibung; jeweils nach Datum
  const liste = useMemo(() => {
    if (!vorschlaege || !genug) return [];
    const wortAnfang = new RegExp(`(^|[^\\p{L}\\p{N}])${escape(vorschlaege.fuer)}`, "iu");
    const klein = vorschlaege.fuer.toLowerCase();
    const rang = (e: EventKurz) => {
      const t = e.titel.toLowerCase();
      if (t.startsWith(klein)) return 0; // „Kirchtag …“
      if (wortAnfang.test(e.titel)) return 1; // „Villacher Kirchtag“
      if (t.includes(klein)) return 2; // „Adventkirchtag“
      return 3; // nur Ort oder Beschreibung
    };
    return [...vorschlaege.events].sort((a, b) => rang(a) - rang(b) || a.beginn.localeCompare(b.beginn));
  }, [vorschlaege, genug]);

  const anwenden = (t: string) => {
    setOffen(false);
    eingabe.current?.blur();
    suchen(t.trim());
  };
  const zeigen = offen && genug;
  const aktuell = vorschlaege?.fuer === sauber;

  return (
    <div className="relative">
      <form
        className="relative z-10"
        onSubmit={(ev) => {
          ev.preventDefault();
          anwenden(text);
        }}
      >
        <label className="flex min-h-14 items-center gap-3 rounded-2xl bg-flaeche px-4 shadow-karte ring-1 ring-linie focus-within:ring-2 focus-within:ring-see">
          <Search aria-hidden className="h-6 w-6 shrink-0 text-gedaempft" />
          <input
            ref={eingabe}
            value={text}
            onChange={(ev) => {
              setText(ev.target.value);
              setOffen(true);
            }}
            onFocus={() => setOffen(true)}
            onKeyDown={(ev) => ev.key === "Escape" && setOffen(false)}
            placeholder="z. B. Kirchtag, Messe, Spittal …"
            aria-label="Suchbegriff"
            aria-expanded={zeigen}
            aria-controls="such-vorschlaege"
            role="combobox"
            aria-autocomplete="list"
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

      {zeigen && (
        <>
          {/* Tippen daneben schließt die Vorschläge */}
          <button type="button" aria-label="Vorschläge schließen" tabIndex={-1} className="fixed inset-0 z-0 cursor-default" onClick={() => setOffen(false)} />
          <div
            id="such-vorschlaege"
            role="listbox"
            className="absolute inset-x-0 top-full z-10 mt-2 max-h-[min(62dvh,32rem)] overflow-y-auto overscroll-contain rounded-2xl bg-flaeche shadow-2xl ring-1 ring-linie"
          >
            {!aktuell ? (
              <p className="flex items-center gap-2 px-4 py-4 text-gedaempft">
                <LoaderCircle className="h-5 w-5 animate-spin" /> Suche nach „{sauber}“ …
              </p>
            ) : liste.length === 0 ? (
              <p className="px-4 py-4 text-gedaempft">
                Nichts mit „{sauber}“ gefunden. Probier ein anderes Wort oder einen größeren Umkreis.
              </p>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => anwenden(sauber)}
                  className="sticky top-0 z-10 flex min-h-14 w-full items-center gap-3 border-b border-linie bg-flaeche px-4 text-left font-bold text-see"
                >
                  <Search className="h-5 w-5 shrink-0" />
                  <span className="flex-1">Alle Treffer für „{sauber}“ in der Liste zeigen</span>
                </button>
                <ul>
                  {liste.slice(0, MAX_ZEIGEN).map((e) => (
                    <li key={e.id} role="option" aria-selected={false}>
                      <Link
                        href={`/event/${e.id}`}
                        onClick={() => setOffen(false)}
                        className="flex items-center gap-3 border-b border-linie/60 px-4 py-2.5 hover:bg-flaeche-2"
                      >
                        <span className="h-11 w-11 shrink-0 overflow-hidden rounded-xl">
                          <KategorieBild kategorie={e.kategorien[0] ?? "sonstiges"} className="h-full w-full" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="line-clamp-2 font-semibold leading-snug">
                            <Markiert text={e.titel} suche={sauber} />
                          </span>
                          <span className="mt-0.5 flex items-center gap-1 truncate text-[0.88rem] text-gedaempft">
                            <CalendarDays className="h-4 w-4 shrink-0" /> {tagText(e.beginn)} · {zeitText(e)}
                          </span>
                          <span className="flex items-center gap-1 truncate text-[0.88rem] text-gedaempft">
                            <MapPin className="h-4 w-4 shrink-0" /> <span className="truncate">{e.ortName}</span>
                            {e.entfernungKm != null && <span className="shrink-0">· {Math.round(e.entfernungKm)} km</span>}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
                {liste.length > MAX_ZEIGEN && (
                  <button type="button" onClick={() => anwenden(sauber)} className="min-h-12 w-full px-4 text-left font-semibold text-see">
                    … und {liste.length - MAX_ZEIGEN} weitere – alle anzeigen
                  </button>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
