"use client";

import Link from "next/link";
import { useState } from "react";
import { motion } from "motion/react";
import { MapPin, TriangleAlert, Clock } from "lucide-react";
import type { EventKurz } from "@/lib/event-typ";
import { LAENDER } from "@/lib/event-typ";
import type { Ansicht } from "@/lib/client/app-zustand";
import { kalenderblatt, laeuftGerade, tagText, zeitText } from "@/lib/datum";
import { KategorieBild, kategorieInfo } from "./KategorieBild";
import { HerzKnopf } from "./HerzKnopf";

function Bild({ event, kat, className }: { event: EventKurz; kat: string; className: string }) {
  const [kaputt, setKaputt] = useState(false);
  if (!event.bildUrl || kaputt) return <KategorieBild kategorie={kat} className={className} />;
  return (
    // Foto direkt von der Originalseite (verlinkt, nicht kopiert)
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={event.bildUrl}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setKaputt(true)}
      className={`${className} object-cover transition-transform duration-500 group-hover:scale-[1.03]`}
    />
  );
}

function Kalenderblatt({ iso, klein }: { iso: string; klein?: boolean }) {
  const blatt = kalenderblatt(iso);
  return (
    <div className={`rounded-2xl bg-flaeche/95 text-center leading-none shadow ${klein ? "min-w-12 px-2 py-1" : "min-w-14 px-2.5 py-1.5"}`}>
      <div className="text-[0.7rem] font-bold tracking-wide text-gedaempft">{blatt.wochentag}</div>
      <div className={`font-titel text-foreground ${klein ? "text-xl" : "text-2xl"}`}>{blatt.tag}</div>
      <div className="text-[0.7rem] font-semibold text-gedaempft">{blatt.monat}</div>
    </div>
  );
}

function Warnung({ event }: { event: EventKurz }) {
  const abgesagt = event.status === "abgesagt";
  const geaendert = event.status === "geaendert";
  if (!(event.sicherheit === "unsicher" || geaendert || abgesagt)) return null;
  return (
    <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-abendsonne-zart px-3 py-1 text-[0.85rem] font-semibold text-abendsonne">
      <TriangleAlert aria-hidden className="h-4 w-4" />
      {abgesagt ? "Abgesagt?" : geaendert ? "Termin geändert" : "Datum bitte prüfen"}
    </p>
  );
}

const km = (e: EventKurz) => (e.entfernungKm != null ? `${Math.round(e.entfernungKm)} km` : null);

export function EventKarte({
  event,
  index = 0,
  zeigeTag = true,
  ansicht = "gross",
  mitBild = false,
}: {
  event: EventKurz;
  index?: number;
  zeigeTag?: boolean;
  ansicht?: Ansicht;
  /** Liste mit kleinem Bild statt Kalenderblatt (Datum steht dann in der Zeile) */
  mitBild?: boolean;
}) {
  const hauptKat = event.kategorien[0] ?? "sonstiges";
  const kat = kategorieInfo(hauptKat);
  const laeuft = laeuftGerade(event);
  const abgesagt = event.status === "abgesagt";
  const wann = `${zeigeTag && !laeuft ? `${tagText(event.beginn)} · ` : ""}${zeitText(event)}`;
  const titelKlasse = `font-titel text-foreground hyphens-auto [overflow-wrap:anywhere] ${abgesagt ? "line-through opacity-60" : ""}`;
  const land = event.land !== "AT" ? <span aria-label={LAENDER[event.land].name}>{LAENDER[event.land].flagge} </span> : null;

  const huelle = (inhalt: React.ReactNode, herz: React.ReactNode, linkKlasse: string) => (
    <motion.li
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index, 8) * 0.04, ease: "easeOut" }}
      className="relative min-w-0 list-none"
    >
      <Link href={`/event/${event.id}`} className={`group block overflow-hidden bg-flaeche shadow-karte ring-1 ring-linie transition-transform active:scale-[0.99] ${linkKlasse}`}>
        {inhalt}
      </Link>
      {herz}
    </motion.li>
  );

  // ── Liste: kompakt, viele auf einen Blick ──
  if (ansicht === "liste") {
    return huelle(
      <div className={`flex items-center gap-3 pl-3 pr-14 ${mitBild ? "py-2.5" : "py-3"}`}>
        {mitBild ? (
          <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl">
            <Bild event={event} kat={hauptKat} className="h-full w-full" />
          </div>
        ) : zeigeTag ? (
          <Kalenderblatt iso={event.beginn} klein />
        ) : (
          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl">
            <KategorieBild kategorie={hauptKat} className="h-full w-full" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h3 className={`${titelKlasse} line-clamp-2 leading-snug ${mitBild ? "text-[1.02rem]" : "text-[1.1rem]"}`}>{event.titel}</h3>
          <p className="mt-0.5 truncate text-[0.9rem] text-gedaempft">
            {laeuft && event.ende ? (
              <strong className="text-laerche">
                läuft bis {kalenderblatt(event.ende).tag}. {kalenderblatt(event.ende).monat}
              </strong>
            ) : mitBild ? (
              wann
            ) : (
              zeitText(event)
            )}
          </p>
          <p className="flex min-w-0 gap-1 text-[0.9rem] text-gedaempft">
            <span className="min-w-0 truncate">
              {land}
              {event.ortName}
            </span>
            {km(event) && <strong className="shrink-0 font-semibold text-foreground">· {km(event)}</strong>}
          </p>
          <Warnung event={event} />
        </div>
      </div>,
      <div className="absolute right-2 top-1/2 -translate-y-1/2">
        <HerzKnopf eventId={event.id} titel={event.titel} />
      </div>,
      "rounded-2xl"
    );
  }

  // ── Kacheln: zwei nebeneinander ──
  if (ansicht === "kacheln") {
    return huelle(
      <>
        <div className="relative h-24 w-full overflow-hidden">
          <Bild event={event} kat={hauptKat} className="h-full w-full" />
          {zeigeTag && (
            <div className="absolute left-2 top-2">
              <Kalenderblatt iso={event.beginn} klein />
            </div>
          )}
        </div>
        <div className="px-3 pb-3 pt-2">
          <p className="truncate text-[0.75rem] font-bold uppercase tracking-wide" style={{ color: kat.farbe }}>
            {kat.name}
          </p>
          <h3 className={`${titelKlasse} mt-0.5 line-clamp-3 text-[1.05rem] leading-snug`}>{event.titel}</h3>
          <p className="mt-1 truncate text-[0.85rem] text-gedaempft">{laeuft ? "läuft gerade" : zeitText(event)}</p>
          <p className="truncate text-[0.85rem] text-gedaempft">
            {land}
            {event.ortName}
          </p>
          {km(event) && <p className="text-[0.85rem] font-semibold">{km(event)}</p>}
          <Warnung event={event} />
        </div>
      </>,
      <div className="absolute right-1.5 top-1.5">
        <HerzKnopf eventId={event.id} titel={event.titel} />
      </div>,
      "h-full rounded-2xl"
    );
  }

  // ── Groß: Bild oben, alles gut lesbar ──
  return huelle(
    <>
      <div className="relative h-36 w-full overflow-hidden">
        <Bild event={event} kat={hauptKat} className="h-full w-full" />
        {zeigeTag && (
          <div className="absolute left-3 top-3">
            <Kalenderblatt iso={event.beginn} />
          </div>
        )}
        {laeuft && (
          <span className="absolute bottom-3 left-3 rounded-full bg-laerche px-3 py-1 text-[0.85rem] font-bold text-white shadow">läuft gerade</span>
        )}
      </div>

      <div className="px-4 pb-4 pt-3">
        <p className="text-[0.85rem] font-bold uppercase tracking-wide" style={{ color: kat.farbe }}>
          {kat.name}
        </p>
        <h3 className={`${titelKlasse} mt-1 text-[1.3rem] leading-snug`}>{event.titel}</h3>

        <p className="mt-2 flex min-w-0 items-start gap-2 text-gedaempft">
          <Clock aria-hidden className="mt-0.5 h-5 w-5 shrink-0" />
          <span className="min-w-0">{wann}</span>
        </p>
        <p className="mt-1 flex min-w-0 items-center gap-2 text-gedaempft">
          <MapPin aria-hidden className="h-5 w-5 shrink-0" />
          <span className="min-w-0 truncate">
            {land}
            {event.ortName}
          </span>
          {km(event) && <strong className="shrink-0 font-semibold text-foreground">· {km(event)}</strong>}
        </p>
        <Warnung event={event} />
      </div>
    </>,
    <div className="absolute right-3 top-3">
      <HerzKnopf eventId={event.id} titel={event.titel} />
    </div>,
    "rounded-3xl"
  );
}
