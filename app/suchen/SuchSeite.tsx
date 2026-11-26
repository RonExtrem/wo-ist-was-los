"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LoaderCircle, Search, SlidersHorizontal, X, RotateCcw, Sparkles } from "lucide-react";
import { useApp } from "@/lib/client/app-zustand";
import { useEvents } from "@/lib/client/use-events";
import { AnsichtWahl, EventListe } from "@/components/EventListe";
import { StartpunktWahl } from "@/components/StartpunktWahl";
import { KATEGORIE_ICON } from "@/components/KategorieBild";
import { KATEGORIEN } from "@/lib/kategorien";
import { LAENDER, type EventKurz } from "@/lib/event-typ";
import { laeuftGerade, tagUeberschrift, wienTag, zeitfenster } from "@/lib/datum";

const ZEITEN = [
  { id: "heute-morgen", text: "Heute & morgen" },
  { id: "wochenende", text: "Wochenende" },
  { id: "woche", text: "7 Tage" },
  { id: "monat", text: "30 Tage" },
  { id: "drei-monate", text: "3 Monate" },
  { id: "jahr", text: "1 Jahr" },
] as const;
type ZeitId = (typeof ZEITEN)[number]["id"];
const UMKREISE = ["10", "25", "50", "100", "150", "alle"] as const;

function Chip({ an, onClick, children }: { an: boolean; onClick: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLButtonElement>(null);
  // Gewählter Knopf rückt in waagrechten Reihen ins Bild
  useEffect(() => {
    if (an) ref.current?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [an]);
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      aria-pressed={an}
      className={`flex min-h-12 shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-4 text-[0.95rem] font-semibold transition-colors ${
        an ? "bg-see text-white shadow" : "bg-flaeche text-foreground ring-1 ring-linie hover:bg-see-zart"
      }`}
    >
      {children}
    </button>
  );
}

function Reihe({ titel, children }: { titel: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <p className="mb-2 text-[0.9rem] font-semibold text-gedaempft">{titel}</p>
      <div className="ohne-balken -mx-5 flex gap-2 overflow-x-auto px-5 pb-1">{children}</div>
    </div>
  );
}

export function SuchSeite() {
  const { bereit, startpunkt, einstellungen } = useApp();
  const params = useSearchParams();
  const router = useRouter();
  const pfad = usePathname();
  const [mehr, setMehr] = useState(false);

  // Filter stehen in der Adresse → „Alle“-Links der Startseite funktionieren, Zurück-Knopf auch
  const zeit = (ZEITEN.find((z) => z.id === params.get("zeit"))?.id ?? "monat") as ZeitId;
  const radius = (params.get("radius") ?? String(einstellungen.umkreisKm)) as string;
  const katText = params.get("kat") ?? "";
  const landText = params.get("land") ?? "";
  const kat = useMemo(() => katText.split(",").filter(Boolean), [katText]);
  const land = useMemo(() => landText.split(",").filter(Boolean), [landText]);
  const gratis = params.get("gratis") === "1";
  const q = params.get("q") ?? "";
  const neu = Number(params.get("neu")) || 0;
  const [suchText, setSuchText] = useState(q);

  const setze = (aenderung: Record<string, string | null>) => {
    // Aktuelle Adresse als Basis – so gehen schnelle Tipps hintereinander nicht verloren
    const neu = new URLSearchParams(window.location.search);
    for (const [k, v] of Object.entries(aenderung)) {
      if (v == null || v === "") neu.delete(k);
      else neu.set(k, v);
    }
    router.replace(`${pfad}?${neu}`, { scroll: false });
  };
  const umschalten = (feld: "kat" | "land", wert: string) => {
    const liste = (new URLSearchParams(window.location.search).get(feld) ?? "").split(",").filter(Boolean);
    return (liste.includes(wert) ? liste.filter((x) => x !== wert) : [...liste, wert]).join(",");
  };

  const abfrage = useMemo(() => {
    if (!bereit) return null;
    const { von, bis } = zeitfenster(zeit);
    return {
      lat: startpunkt.lat,
      lng: startpunkt.lng,
      radius: radius === "alle" ? ("alle" as const) : Number(radius) || 50,
      von,
      bis,
      kat,
      land,
      gratis,
      q,
      neu,
    };
  }, [bereit, startpunkt.lat, startpunkt.lng, zeit, radius, kat, land, gratis, q, neu]);
  const { events, fehler, laedt } = useEvents(abfrage);

  // Nach Tagen gruppieren; laufende mehrtägige Events kommen oben in „Läuft gerade“
  const gruppen = useMemo(() => {
    if (!events) return [];
    const laufend: EventKurz[] = [];
    const nachTag = new Map<string, EventKurz[]>();
    for (const e of events) {
      if (laeuftGerade(e)) laufend.push(e);
      else {
        const t = wienTag(new Date(e.beginn));
        nachTag.set(t, [...(nachTag.get(t) ?? []), e]);
      }
    }
    const g = [...nachTag.entries()].map(([tag, liste]) => ({ titel: tagUeberschrift(tag), events: liste }));
    if (laufend.length) g.unshift({ titel: "Läuft gerade", events: laufend });
    return g;
  }, [events]);

  const filterAnzahl = kat.length + land.length + (gratis ? 1 : 0);

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-5 pt-[calc(env(safe-area-inset-top)+1.25rem)]">
      <h1 className="font-titel text-[2.1rem] leading-tight">Suchen</h1>

      <form
        className="mt-4"
        onSubmit={(e) => {
          e.preventDefault();
          setze({ q: suchText.trim() || null });
        }}
      >
        <label className="flex min-h-14 items-center gap-3 rounded-2xl bg-flaeche px-4 shadow-karte ring-1 ring-linie focus-within:ring-2 focus-within:ring-see">
          <Search aria-hidden className="h-6 w-6 text-gedaempft" />
          <input
            value={suchText}
            onChange={(e) => setSuchText(e.target.value)}
            onBlur={() => suchText.trim() !== q && setze({ q: suchText.trim() || null })}
            placeholder="z. B. Kirchtag, Messe, Spittal …"
            aria-label="Suchbegriff"
            enterKeyHint="search"
            className="h-14 flex-1 bg-transparent text-lg outline-none placeholder:text-gedaempft"
          />
          {suchText && (
            <button type="button" aria-label="Suchbegriff löschen" onClick={() => { setSuchText(""); setze({ q: null }); }} className="flex h-10 w-10 items-center justify-center rounded-full bg-flaeche-2">
              <X className="h-5 w-5" />
            </button>
          )}
        </label>
      </form>

      {neu > 0 && (
        <button
          type="button"
          onClick={() => setze({ neu: null })}
          className="mt-4 flex min-h-12 items-center gap-2 rounded-full bg-abendsonne px-4 font-semibold text-white shadow"
        >
          <Sparkles className="h-5 w-5" /> Nur neue der letzten {neu === 1 ? "24 Stunden" : `${neu} Tage`}
          <X className="h-5 w-5" aria-label="Filter entfernen" />
        </button>
      )}

      <div className="mt-5">
        <StartpunktWahl />
      </div>

      <Reihe titel="Wann?">
        {ZEITEN.map((z) => (
          <Chip key={z.id} an={zeit === z.id} onClick={() => setze({ zeit: z.id })}>
            {z.text}
          </Chip>
        ))}
      </Reihe>

      <Reihe titel="Wie weit?">
        {UMKREISE.map((u) => (
          <Chip key={u} an={radius === u} onClick={() => setze({ radius: u })}>
            {u === "alle" ? "Alle" : `${u} km`}
          </Chip>
        ))}
      </Reihe>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setMehr((m) => !m)}
          aria-expanded={mehr}
          className="flex min-h-12 items-center gap-2 rounded-full bg-flaeche px-4 font-semibold ring-1 ring-linie hover:bg-see-zart"
        >
          <SlidersHorizontal className="h-5 w-5" /> Was & wo genau?
          {filterAnzahl > 0 && <span className="rounded-full bg-see px-2 text-[0.85rem] text-white">{filterAnzahl}</span>}
        </button>
        {filterAnzahl > 0 && (
          <button type="button" onClick={() => setze({ kat: null, land: null, gratis: null })} className="flex min-h-12 items-center gap-2 rounded-full px-3 font-semibold text-see">
            <RotateCcw className="h-4 w-4" /> Zurücksetzen
          </button>
        )}
      </div>

      {mehr && (
        <div className="mt-2 rounded-3xl bg-flaeche-2 p-4">
          <p className="text-[0.9rem] font-semibold text-gedaempft">Themen</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {KATEGORIEN.map((k) => {
              const Icon = KATEGORIE_ICON[k.id];
              return (
                <Chip key={k.id} an={kat.includes(k.id)} onClick={() => setze({ kat: umschalten("kat", k.id) || null })}>
                  <Icon className="h-5 w-5" style={{ color: kat.includes(k.id) ? "white" : k.farbe }} /> {k.name}
                </Chip>
              );
            })}
          </div>
          <p className="mt-4 text-[0.9rem] font-semibold text-gedaempft">Länder</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {Object.entries(LAENDER).map(([id, l]) => (
              <Chip key={id} an={land.includes(id)} onClick={() => setze({ land: umschalten("land", id) || null })}>
                <span aria-hidden>{l.flagge}</span> {l.name}
              </Chip>
            ))}
          </div>
          <p className="mt-4 text-[0.9rem] font-semibold text-gedaempft">Eintritt</p>
          <div className="mt-2 flex gap-2">
            <Chip an={gratis} onClick={() => setze({ gratis: gratis ? null : "1" })}>Nur gratis</Chip>
          </div>
        </div>
      )}

      <div className="mt-6" aria-live="polite">
        {(!bereit || (laedt && !events)) && (
          <div className="flex items-center justify-center gap-3 py-12 text-gedaempft">
            <LoaderCircle className="h-7 w-7 animate-spin" /> Wird gesucht …
          </div>
        )}
        {fehler && <p className="rounded-3xl bg-abendsonne-zart p-5 text-abendsonne">{fehler}</p>}
        {events && !fehler && (
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[0.95rem] text-gedaempft">
              {laedt ? "Wird aktualisiert …" : `${events.length} ${events.length === 1 ? "Veranstaltung" : "Veranstaltungen"} gefunden`}
            </p>
            <AnsichtWahl className="w-full" />
          </div>
        )}
        {events?.length === 0 && !laedt && (
          <div className="rounded-3xl bg-flaeche-2 p-6 text-center">
            <p className="font-titel text-xl">Nichts gefunden</p>
            <p className="mt-2 text-gedaempft">Probier einen größeren Umkreis oder einen längeren Zeitraum.</p>
          </div>
        )}
        {gruppen.map((g) => (
          <section key={g.titel} className="mt-6">
            <h2 className="sticky top-0 z-10 -mx-5 bg-background/95 px-5 py-2 font-titel text-xl backdrop-blur">{g.titel}</h2>
            <div className="mt-2">
              <EventListe events={g.events} zeigeTag={g.titel === "Läuft gerade"} />
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
