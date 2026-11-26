"use client";

import { useEffect, useState } from "react";
import type { EventKurz } from "@/lib/event-typ";

export interface EventAbfrage {
  lat: number;
  lng: number;
  radius: number | "alle";
  von: Date;
  bis: Date;
  kat?: string[];
  land?: string[];
  gratis?: boolean;
  q?: string;
}

interface Ergebnis {
  schluessel: string;
  events: EventKurz[] | null;
  fehler: string | null;
}

/** Lädt Events von /api/events. `abfrage = null` → nichts laden. Alte Ergebnisse bleiben sichtbar, bis neue da sind. */
export function useEvents(abfrage: EventAbfrage | null) {
  const [ergebnis, setErgebnis] = useState<Ergebnis | null>(null);

  const schluessel = abfrage
    ? [abfrage.lat.toFixed(3), abfrage.lng.toFixed(3), abfrage.radius, abfrage.von.toISOString().slice(0, 13), abfrage.bis.toISOString().slice(0, 13),
       abfrage.kat?.join(",") ?? "", abfrage.land?.join(",") ?? "", abfrage.gratis ? 1 : 0, abfrage.q ?? ""].join("|")
    : null;

  useEffect(() => {
    if (!abfrage || !schluessel) return;
    const ctrl = new AbortController();
    const p = new URLSearchParams({
      lat: String(abfrage.lat),
      lng: String(abfrage.lng),
      radius: String(abfrage.radius),
      von: abfrage.von.toISOString(),
      bis: abfrage.bis.toISOString(),
    });
    if (abfrage.kat?.length) p.set("kat", abfrage.kat.join(","));
    if (abfrage.land?.length) p.set("land", abfrage.land.join(","));
    if (abfrage.gratis) p.set("gratis", "1");
    if (abfrage.q) p.set("q", abfrage.q);
    fetch(`/api/events?${p}`, { signal: ctrl.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error(`Fehler ${r.status}`);
        return r.json() as Promise<{ events: EventKurz[] }>;
      })
      .then((d) => setErgebnis({ schluessel, events: d.events, fehler: null }))
      .catch((e: Error) => {
        if (e.name !== "AbortError") {
          setErgebnis({ schluessel, events: null, fehler: "Die Veranstaltungen konnten gerade nicht geladen werden. Bitte später nochmal probieren." });
        }
      });
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- „schluessel“ fasst alle Werte der Abfrage zusammen
  }, [schluessel]);

  const aktuell = ergebnis?.schluessel === schluessel;
  return {
    events: ergebnis?.events ?? null,
    fehler: aktuell ? ergebnis?.fehler ?? null : null,
    laedt: !!schluessel && !aktuell,
  };
}
