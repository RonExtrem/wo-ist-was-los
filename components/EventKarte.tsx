"use client";

import Link from "next/link";
import { useState } from "react";
import { motion } from "motion/react";
import { MapPin, TriangleAlert, Clock } from "lucide-react";
import type { EventKurz } from "@/lib/event-typ";
import { LAENDER } from "@/lib/event-typ";
import { kalenderblatt, laeuftGerade, tagText, zeitText } from "@/lib/datum";
import { KategorieBild, kategorieInfo } from "./KategorieBild";
import { HerzKnopf } from "./HerzKnopf";

export function EventKarte({ event, index = 0, zeigeTag = true }: { event: EventKurz; index?: number; zeigeTag?: boolean }) {
  const [bildKaputt, setBildKaputt] = useState(false);
  const hauptKat = event.kategorien[0] ?? "sonstiges";
  const kat = kategorieInfo(hauptKat);
  const blatt = kalenderblatt(event.beginn);
  const laeuft = laeuftGerade(event);
  const abgesagt = event.status === "abgesagt";
  const geaendert = event.status === "geaendert";

  return (
    <motion.li
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index, 8) * 0.05, ease: "easeOut" }}
      className="relative list-none"
    >
      <Link
        href={`/event/${event.id}`}
        className="group block overflow-hidden rounded-3xl bg-flaeche shadow-karte ring-1 ring-linie transition-transform active:scale-[0.99]"
      >
        <div className="relative h-36 w-full overflow-hidden">
          {event.bildUrl && !bildKaputt ? (
            // Foto direkt von der Originalseite (verlinkt, nicht kopiert)
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={event.bildUrl}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={() => setBildKaputt(true)}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
          ) : (
            <KategorieBild kategorie={hauptKat} className="h-full w-full" />
          )}
          {zeigeTag && (
            <div className="absolute left-3 top-3 min-w-14 rounded-2xl bg-flaeche/95 px-2.5 py-1.5 text-center leading-none shadow">
              <div className="text-[0.7rem] font-bold tracking-wide text-gedaempft">{blatt.wochentag}</div>
              <div className="font-titel text-2xl text-foreground">{blatt.tag}</div>
              <div className="text-[0.7rem] font-semibold text-gedaempft">{blatt.monat}</div>
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
          <h3 className={`font-titel mt-1 text-[1.3rem] leading-snug text-foreground hyphens-auto [overflow-wrap:anywhere] ${abgesagt ? "line-through opacity-60" : ""}`}>
            {event.titel}
          </h3>

          <p className="mt-2 flex min-w-0 items-start gap-2 text-gedaempft">
            <Clock aria-hidden className="mt-0.5 h-5 w-5 shrink-0" />
            <span className="min-w-0">
              {zeigeTag && !laeuft ? `${tagText(event.beginn)} · ` : ""}
              {zeitText(event)}
            </span>
          </p>
          <p className="mt-1 flex min-w-0 items-center gap-2 text-gedaempft">
            <MapPin aria-hidden className="h-5 w-5 shrink-0" />
            <span className="min-w-0 truncate">
              {event.land !== "AT" && <span aria-label={LAENDER[event.land].name}>{LAENDER[event.land].flagge} </span>}
              {event.ortName}
            </span>
            {event.entfernungKm != null && (
              <strong className="shrink-0 font-semibold text-foreground">· {Math.round(event.entfernungKm)} km</strong>
            )}
          </p>

          {(event.sicherheit === "unsicher" || geaendert || abgesagt) && (
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-abendsonne-zart px-3 py-1 text-[0.85rem] font-semibold text-abendsonne">
              <TriangleAlert aria-hidden className="h-4 w-4" />
              {abgesagt ? "Abgesagt?" : geaendert ? "Termin geändert" : "Datum bitte prüfen"}
            </p>
          )}
        </div>
      </Link>
      <div className="absolute right-3 top-3">
        <HerzKnopf eventId={event.id} titel={event.titel} />
      </div>
    </motion.li>
  );
}
