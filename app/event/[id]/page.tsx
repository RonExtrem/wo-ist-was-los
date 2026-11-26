import { Suspense } from "react";
import { notFound } from "next/navigation";
import { CalendarDays, MapPin, Ticket, TriangleAlert, Languages } from "lucide-react";
import { ladeEvent } from "@/lib/events-server";
import { KategorieBild, kategorieInfo, KATEGORIE_ICON } from "@/components/KategorieBild";
import { LAENDER } from "@/lib/event-typ";
import { laeuftGerade, tagText, zeitText } from "@/lib/datum";
import { DetailAktionen, ZurueckKnopf, EntfernungZeile, DetailBild } from "./DetailAktionen";

export default function EventSeite({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div className="p-8 text-gedaempft">Wird geladen …</div>}>
      <EventInhalt params={params} />
    </Suspense>
  );
}

async function EventInhalt({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const e = await ladeEvent(id);
  if (!e) notFound();

  const hauptKat = e.kategorien[0] ?? "sonstiges";
  const sprache = { it: "Italienisch", sl: "Slowenisch", en: "Englisch" }[e.originalsprache];

  return (
    <main className="mx-auto w-full max-w-xl flex-1">
      <div className="relative h-64 w-full overflow-hidden sm:rounded-b-[2rem]">
        {e.bildUrl ? <DetailBild src={e.bildUrl} kategorie={hauptKat} /> : <KategorieBild kategorie={hauptKat} className="h-full w-full" />}
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-background" />
        <div className="absolute left-4 top-[calc(env(safe-area-inset-top)+1rem)]">
          <ZurueckKnopf />
        </div>
      </div>

      <div className="relative -mt-10 px-5">
        <div className="flex flex-wrap gap-2">
          {e.kategorien.map((k) => {
            const info = kategorieInfo(k);
            const Icon = KATEGORIE_ICON[info.id];
            return (
              <span key={k} className="inline-flex items-center gap-1.5 rounded-full bg-flaeche px-3 py-1.5 text-[0.85rem] font-bold shadow-sm ring-1 ring-linie" style={{ color: info.farbe }}>
                <Icon aria-hidden className="h-4 w-4" /> {info.name}
              </span>
            );
          })}
        </div>

        <h1 className={`font-titel mt-3 text-[1.75rem] leading-tight hyphens-auto [overflow-wrap:anywhere] ${e.status === "abgesagt" ? "line-through opacity-60" : ""}`}>{e.titel}</h1>

        {(e.sicherheit === "unsicher" || e.status !== "aktiv") && (
          <div className="mt-4 flex gap-3 rounded-2xl bg-abendsonne-zart p-4 text-abendsonne">
            <TriangleAlert aria-hidden className="mt-0.5 h-6 w-6 shrink-0" />
            <p className="font-semibold">
              {e.status === "verschwunden" || e.status === "abgesagt"
                ? "Dieses Event steht nicht mehr auf der Originalseite – möglicherweise abgesagt. Bitte dort nachschauen."
                : e.status === "geaendert"
                  ? "Der Termin wurde geändert. Bitte auf der Originalseite prüfen."
                  : "Das Datum war auf der Seite nicht ganz eindeutig. Bitte auf der Originalseite prüfen."}
            </p>
          </div>
        )}

        <div className="mt-5 divide-y divide-linie rounded-3xl bg-flaeche shadow-karte ring-1 ring-linie">
          <div className="flex gap-4 p-4">
            <CalendarDays aria-hidden className="mt-0.5 h-6 w-6 shrink-0 text-see" />
            <div>
              <p className="text-lg font-semibold">{laeuftGerade(e) ? "Läuft gerade" : tagText(e.beginn)}</p>
              <p className="text-gedaempft">{zeitText(e)}</p>
            </div>
          </div>
          <div className="flex gap-4 p-4">
            <MapPin aria-hidden className="mt-0.5 h-6 w-6 shrink-0 text-see" />
            <div className="min-w-0">
              <p className="text-lg font-semibold">
                {e.land !== "AT" && <span aria-hidden>{LAENDER[e.land].flagge} </span>}
                {e.ortName}
              </p>
              {e.adresse && <p className="text-gedaempft">{e.adresse}</p>}
              {e.lat != null && e.lng != null && <EntfernungZeile lat={e.lat} lng={e.lng} />}
            </div>
          </div>
          {(e.preisText || e.gratis) && (
            <div className="flex gap-4 p-4">
              <Ticket aria-hidden className="mt-0.5 h-6 w-6 shrink-0 text-see" />
              <p className="text-lg">{e.gratis ? "Eintritt frei" : e.preisText}</p>
            </div>
          )}
        </div>

        {e.kurzbeschreibung && <p className="mt-5 text-[1.1rem] leading-relaxed">{e.kurzbeschreibung}</p>}
        {sprache && (
          <p className="mt-3 flex items-center gap-2 text-[0.9rem] text-gedaempft">
            <Languages aria-hidden className="h-4 w-4" /> Aus dem {sprache}en übersetzt
          </p>
        )}

        <DetailAktionen event={e} />

        <p className="mt-6 text-[0.85rem] text-gedaempft">
          Alle Angaben ohne Gewähr – maßgeblich ist die Originalseite des Veranstalters.
        </p>
      </div>
    </main>
  );
}
