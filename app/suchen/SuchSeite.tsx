"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, LoaderCircle, MapPin, RotateCcw, Shapes, Sparkles, X } from "lucide-react";
import { useApp } from "@/lib/client/app-zustand";
import { useEvents } from "@/lib/client/use-events";
import { useStunde } from "@/lib/client/use-stunde";
import { aufStunde, useZahlen } from "@/lib/client/use-zahlen";
import { AnsichtWahl, EventListe } from "@/components/EventListe";
import { StartpunktWahl } from "@/components/StartpunktWahl";
import { SuchFeld } from "@/components/SuchFeld";
import { KATEGORIE_ICON } from "@/components/KategorieBild";
import { KATEGORIEN } from "@/lib/kategorien";
import { LAENDER, type EventKurz } from "@/lib/event-typ";
import { REGIONEN, landVonRegion } from "@/lib/regionen";
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
const UMKREISE = ["10", "25", "50", "75", "100", "150", "alle"] as const;
/** Höchstens so viele Veranstaltungen in der Liste (darüber: Hinweis zum Eingrenzen) */
const MAX_LISTE = 500;

/** Kleine Zahl im Chip (wie viele Veranstaltungen) – 0 bleibt sichtbar, aber blass */
function Zahl({ n, an }: { n: number | undefined; an: boolean }) {
  if (n == null) return null;
  return <span className={`text-[0.85rem] font-bold ${an ? "text-white/85" : n === 0 ? "text-gedaempft/60" : "text-gedaempft"}`}>{n}</span>;
}

/** Knopf, der einen Filter-Bereich auf- und zuklappt */
function Klapper({ offen, onClick, icon: Icon, text, anzahl }: { offen: boolean; onClick: () => void; icon: typeof MapPin; text: string; anzahl: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={offen}
      className={`flex min-h-12 items-center gap-2 rounded-full px-4 font-semibold ring-1 transition-colors ${
        offen ? "bg-see-zart text-see ring-see" : "bg-flaeche ring-linie hover:bg-see-zart"
      }`}
    >
      <Icon className="h-5 w-5" /> {text}
      {anzahl > 0 && <span className="rounded-full bg-see px-2 text-[0.85rem] text-white">{anzahl}</span>}
      <ChevronDown className={`h-4 w-4 transition-transform ${offen ? "rotate-180" : ""}`} />
    </button>
  );
}

function Chip({ an, onClick, children }: { an: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={an}
      className={`flex min-h-12 items-center gap-2 rounded-full px-4 text-[0.95rem] font-semibold transition-colors ${
        an ? "bg-see text-white shadow" : "bg-flaeche text-foreground ring-1 ring-linie hover:bg-see-zart"
      }`}
    >
      {children}
    </button>
  );
}

function Reihe({ titel, tour, children }: { titel: string; tour?: string; children: React.ReactNode }) {
  return (
    <div data-tour={tour} className="mt-4">
      <p className="mb-2 text-[0.9rem] font-semibold text-gedaempft">{titel}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

export function SuchSeite() {
  const { bereit, startpunkt, einstellungen } = useApp();
  const params = useSearchParams();
  const router = useRouter();
  const pfad = usePathname();
  const [offen, setOffen] = useState<"themen" | "wo" | null>(null);

  // Filter stehen in der Adresse → „Alle“-Links der Startseite funktionieren, Zurück-Knopf auch
  const zeit = (ZEITEN.find((z) => z.id === params.get("zeit"))?.id ?? "monat") as ZeitId;
  const radius = (params.get("radius") ?? String(einstellungen.umkreisKm)) as string;
  const katText = params.get("kat") ?? "";
  const landText = params.get("land") ?? "";
  const regionText = params.get("region") ?? "";
  const kat = useMemo(() => katText.split(",").filter(Boolean), [katText]);
  const land = useMemo(() => landText.split(",").filter(Boolean), [landText]);
  const region = useMemo(() => regionText.split(",").filter(Boolean), [regionText]);
  const gratis = params.get("gratis") === "1";
  const q = params.get("q") ?? "";
  const neu = Number(params.get("neu")) || 0;

  const setze = (aenderung: Record<string, string | null>) => {
    // Aktuelle Adresse als Basis – so gehen schnelle Tipps hintereinander nicht verloren
    const neu = new URLSearchParams(window.location.search);
    for (const [k, v] of Object.entries(aenderung)) {
      if (v == null || v === "") neu.delete(k);
      else neu.set(k, v);
    }
    router.replace(`${pfad}?${neu}`, { scroll: false });
  };
  const umschalten = (feld: "kat" | "land" | "region", wert: string) => {
    const liste = (new URLSearchParams(window.location.search).get(feld) ?? "").split(",").filter(Boolean);
    return (liste.includes(wert) ? liste.filter((x) => x !== wert) : [...liste, wert]).join(",");
  };

  const stunde = useStunde(); // rechnet den Zeitraum neu, wenn die App über Nacht offen blieb
  const abfrage = useMemo(() => {
    if (!bereit || !stunde) return null;
    const { von, bis } = zeitfenster(zeit);
    return {
      lat: startpunkt.lat,
      lng: startpunkt.lng,
      radius: radius === "alle" ? ("alle" as const) : Number(radius) || 50,
      von,
      bis,
      kat,
      land,
      region,
      gratis,
      q,
      neu,
      max: MAX_LISTE,
    };
  }, [bereit, stunde, startpunkt.lat, startpunkt.lng, zeit, radius, kat, land, region, gratis, q, neu]);
  const { events, fehler, laedt } = useEvents(abfrage);

  // Zahlen pro Land (im Umkreis – so viele zeigt die Liste nach dem Antippen) und Bundesland (ganzes Bundesland),
  // nur wenn „Land & Bundesland" offen ist. Auf die Stunde gerundet, sonst springen die Knöpfe bei jedem Antippen.
  const z = useZahlen(
    offen === "wo" && abfrage
      ? {
          von: aufStunde(abfrage.von),
          bis: aufStunde(abfrage.bis),
          kat: kat.join(","),
          gratis: gratis ? "1" : "",
          q,
          neu: neu ? String(neu) : "",
          ...(abfrage.radius === "alle" ? {} : { lat: String(abfrage.lat), lng: String(abfrage.lng), radius: String(abfrage.radius) }),
        }
      : null
  );

  const landUmschalten = (id: string) => {
    const neuLand = umschalten("land", id);
    // Land abgewählt → seine Bundesländer auch weg
    const neuRegion = neuLand.split(",").includes(id) ? regionText : region.filter((r) => landVonRegion(r) !== id).join(",");
    setze({ land: neuLand || null, region: neuRegion || null });
  };
  // Ein Bundesland ersetzt den Umkreis (wie bei Willhaben): es wird das ganze Bundesland gezeigt
  const regionUmschalten = (id: string) => setze({ region: umschalten("region", id) || null, radius: "alle" });
  const ganzesLand = (l: string) => setze({ region: region.filter((r) => landVonRegion(r) !== l).join(",") || null });

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

  const filterAnzahl = kat.length + land.length + region.length + (gratis ? 1 : 0);

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-5 pt-[calc(env(safe-area-inset-top)+1.25rem)]">
      <h1 className="font-titel text-[2.1rem] leading-tight">Suchen</h1>

      {/* Suchfeld läuft beim Scrollen oben mit; Antippen öffnet den Such-Bildschirm mit Vorschlägen */}
      <SuchFeld
        key={q}
        wert={q}
        // Gleicher Zeitraum wie die Vorschläge (12 Monate), damit die Trefferzahl in der Liste stimmt
        suchen={(t) => setze(t ? { q: t, zeit: "jahr" } : { q: null })}
        lat={startpunkt.lat}
        lng={startpunkt.lng}
        radius={radius === "alle" ? "alle" : Number(radius) || 50}
        // Dieselben Filter wie die Liste, damit „N Treffer" zur Liste passt
        filter={{ kat, land, region, gratis, neu }}
      />

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

      <Reihe titel="Wann?" tour="wann">
        {ZEITEN.map((z) => (
          <Chip key={z.id} an={zeit === z.id} onClick={() => setze({ zeit: z.id })}>
            {z.text}
          </Chip>
        ))}
      </Reihe>

      <Reihe titel="Wie weit?" tour="wie-weit">
        {UMKREISE.map((u) => (
          // Ein km-Umkreis sucht wieder ab dem Startpunkt – gewählte Bundesländer fallen dann weg
          <Chip key={u} an={radius === u} onClick={() => setze(u === "alle" ? { radius: u } : { radius: u, region: null })}>
            {u === "alle" ? "Alle" : `${u} km`}
          </Chip>
        ))}
      </Reihe>

      <div data-tour="mehr-filter" className="mt-4">
        <p className="mb-2 text-[0.9rem] font-semibold text-gedaempft">Genauer eingrenzen</p>
        <div className="flex flex-wrap items-center gap-2">
          <Klapper offen={offen === "themen"} onClick={() => setOffen((o) => (o === "themen" ? null : "themen"))} icon={Shapes} text="Themen" anzahl={kat.length} />
          <Klapper
            offen={offen === "wo"}
            onClick={() => setOffen((o) => (o === "wo" ? null : "wo"))}
            icon={MapPin}
            text="Land & Bundesland"
            anzahl={land.length + region.length}
          />
          <Chip an={gratis} onClick={() => setze({ gratis: gratis ? null : "1" })}>
            Nur gratis
          </Chip>
          {filterAnzahl > 0 && (
            <button
              type="button"
              onClick={() => setze({ kat: null, land: null, region: null, gratis: null })}
              className="flex min-h-12 items-center gap-2 rounded-full px-3 font-semibold text-see"
            >
              <RotateCcw className="h-4 w-4" /> Zurücksetzen
            </button>
          )}
        </div>
      </div>

      {offen === "themen" && (
        <div className="mt-3 rounded-3xl bg-flaeche-2 p-4">
          <p className="font-semibold">Was interessiert dich?</p>
          <p className="text-[0.9rem] text-gedaempft">Nichts angetippt = alle Themen. Mehrere gehen auch.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {KATEGORIEN.map((k) => {
              const Icon = KATEGORIE_ICON[k.id];
              return (
                <Chip key={k.id} an={kat.includes(k.id)} onClick={() => setze({ kat: umschalten("kat", k.id) || null })}>
                  <Icon className="h-5 w-5" style={{ color: kat.includes(k.id) ? "white" : k.farbe }} /> {k.name}
                </Chip>
              );
            })}
          </div>
        </div>
      )}

      {offen === "wo" && (
        <div className="mt-3 rounded-3xl bg-flaeche-2 p-4">
          <p className="font-semibold">In welchem Land?</p>
          <p className="text-[0.9rem] text-gedaempft">Nichts angetippt = alle Länder. Bei Österreich und Italien kannst du danach einzelne Bundesländer bzw. Regionen wählen.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {Object.entries(LAENDER).map(([id, l]) => (
              <Chip key={id} an={land.includes(id)} onClick={() => landUmschalten(id)}>
                <span aria-hidden>{l.flagge}</span> {l.name} <Zahl n={z ? (z[id] ?? 0) : undefined} an={land.includes(id)} />
              </Chip>
            ))}
          </div>

          {land
            .filter((l) => REGIONEN[l])
            .map((l) => {
              const gewaehlt = region.filter((r) => landVonRegion(r) === l);
              return (
                <div key={l} className="mt-4 rounded-2xl bg-flaeche p-3 ring-1 ring-linie">
                  <p className="font-semibold">
                    <span aria-hidden>{LAENDER[l].flagge}</span> {REGIONEN[l].titel} in {LAENDER[l].name}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Chip an={gewaehlt.length === 0} onClick={() => ganzesLand(l)}>
                      Ganz {LAENDER[l].name}
                    </Chip>
                    {REGIONEN[l].liste.map((r) => (
                      <Chip key={r.id} an={region.includes(r.id)} onClick={() => regionUmschalten(r.id)}>
                        {r.name} <Zahl n={z ? (z[r.id] ?? 0) : undefined} an={region.includes(r.id)} />
                      </Chip>
                    ))}
                  </div>
                </div>
              );
            })}
          {region.length > 0 && (
            <p className="mt-3 text-[0.9rem] text-gedaempft">
              Bei einem Bundesland wird das ganze Bundesland gezeigt – „Wie weit?“ steht deshalb auf „Alle“.
            </p>
          )}
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
              {laedt
                ? "Wird aktualisiert …"
                : events.length >= MAX_LISTE
                  ? `Mehr als ${MAX_LISTE} Veranstaltungen – hier die nächsten ${MAX_LISTE}. Mit Zeitraum, Umkreis oder Themen grenzt du ein.`
                  : `${events.length} ${events.length === 1 ? "Veranstaltung" : "Veranstaltungen"} gefunden`}
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
            <h2 className="sticky top-[calc(env(safe-area-inset-top)+5.25rem)] z-10 -mx-5 bg-background/95 px-5 py-2 font-titel text-xl backdrop-blur">{g.titel}</h2>
            <div className="mt-2">
              <EventListe events={g.events} zeigeTag={g.titel === "Läuft gerade"} />
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
