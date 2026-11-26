"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Heart, LoaderCircle } from "lucide-react";
import { useApp } from "@/lib/client/app-zustand";
import { AnsichtWahl, EventListe } from "@/components/EventListe";
import type { EventKurz } from "@/lib/event-typ";

export default function MeineEvents() {
  const { api, favoriten, bereit } = useApp();
  const [daten, setDaten] = useState<{ events: EventKurz[]; jetzt: number } | null>(null);
  const events = daten?.events ?? null;

  useEffect(() => {
    if (!bereit) return;
    api("/api/favoriten")
      .then((r) => (r.ok ? r.json() : { events: [] }))
      .then((d: { events: EventKurz[] }) => setDaten({ events: d.events, jetzt: Date.now() }))
      .catch(() => setDaten({ events: [], jetzt: Date.now() }));
    // nur beim Öffnen laden; Entfernen wirkt sofort über „favoriten“
  }, [api, bereit]);

  const sichtbar = (events ?? []).filter((e) => favoriten.has(e.id));
  const jetzt = daten?.jetzt ?? 0;
  const kommend = sichtbar.filter((e) => new Date(e.ende ?? e.beginn).getTime() >= jetzt);
  const vorbei = sichtbar.filter((e) => new Date(e.ende ?? e.beginn).getTime() < jetzt).reverse();

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-5 pt-[calc(env(safe-area-inset-top)+1.25rem)]">
      <h1 className="font-titel text-[2.1rem] leading-tight">Meine Events</h1>
      <p className="mt-1 text-gedaempft">Alles, was du mit dem Herz gemerkt hast.</p>

      {events === null ? (
        <div className="flex items-center justify-center gap-3 py-16 text-gedaempft">
          <LoaderCircle className="h-7 w-7 animate-spin" /> Wird geladen …
        </div>
      ) : sichtbar.length === 0 ? (
        <div className="mt-8 flex flex-col items-center rounded-3xl bg-flaeche-2 px-6 py-10 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-abendsonne-zart text-abendsonne">
            <Heart className="h-8 w-8" />
          </span>
          <p className="font-titel mt-4 text-xl">Noch nichts gemerkt</p>
          <p className="mt-2 text-gedaempft">Tipp bei einer Veranstaltung auf das Herz – dann findest du sie hier wieder.</p>
          <Link href="/" className="mt-5 flex min-h-12 items-center rounded-full bg-see px-6 font-semibold text-white">
            Veranstaltungen ansehen
          </Link>
        </div>
      ) : (
        <>
          <AnsichtWahl className="mt-6 mb-3 w-full" />
          <EventListe events={kommend} />
          {vorbei.length > 0 && (
            <section className="mt-10 opacity-60">
              <h2 className="font-titel text-xl">Schon vorbei</h2>
              <div className="mt-3">
                <EventListe events={vorbei} />
              </div>
            </section>
          )}
        </>
      )}
    </main>
  );
}
