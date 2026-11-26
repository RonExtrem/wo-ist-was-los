"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CalendarPlus, ExternalLink, Route, Share2, Check } from "lucide-react";
import type { EventDetail } from "@/lib/event-typ";
import { useApp } from "@/lib/client/app-zustand";
import { HerzKnopf } from "@/components/HerzKnopf";
import { KategorieBild } from "@/components/KategorieBild";

export function ZurueckKnopf() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => (window.history.length > 1 ? router.back() : router.push("/"))}
      aria-label="Zurück"
      className="flex h-12 w-12 items-center justify-center rounded-full bg-flaeche/90 text-foreground shadow backdrop-blur"
    >
      <ArrowLeft className="h-6 w-6" />
    </button>
  );
}

export function DetailBild({ src, kategorie }: { src: string; kategorie: string }) {
  const [kaputt, setKaputt] = useState(false);
  if (kaputt) return <KategorieBild kategorie={kategorie} className="h-full w-full" />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" referrerPolicy="no-referrer" onError={() => setKaputt(true)} className="h-full w-full object-cover" />;
}

function km(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const r = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(x));
}

export function EntfernungZeile({ lat, lng }: { lat: number; lng: number }) {
  const { startpunkt, bereit } = useApp();
  if (!bereit) return null;
  const d = km(startpunkt, { lat, lng });
  return (
    <p className="mt-1 font-semibold text-laerche">
      ca. {Math.round(d)} km Luftlinie von {startpunkt.art === "hier" ? "deinem Standort" : startpunkt.name}
    </p>
  );
}

/** Google-Kalender-Link (öffnet am Android-Handy direkt den Kalender). */
function kalenderLink(e: EventDetail): string {
  const f = (iso: string) => iso.replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const tag = (iso: string) =>
    new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Vienna" }).format(new Date(iso)).replace(/-/g, "");
  let dates: string;
  if (e.ganztaegig) {
    const ende = new Date(new Date(e.ende ?? e.beginn).getTime() + 86_400_000).toISOString();
    dates = `${tag(e.beginn)}/${tag(ende)}`;
  } else {
    const ende = e.ende ?? new Date(new Date(e.beginn).getTime() + 2 * 3600_000).toISOString();
    dates = `${f(e.beginn)}/${f(ende)}`;
  }
  const quelle = e.links[0]?.url ?? "";
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: e.titel,
    dates,
    location: [e.ortName, e.adresse].filter(Boolean).join(", "),
    details: `${e.kurzbeschreibung ?? ""}\n\nMehr Infos: ${quelle}\n(gefunden mit „Wo is wos los?“)`,
  });
  return `https://calendar.google.com/calendar/render?${p}`;
}

export function DetailAktionen({ event: e }: { event: EventDetail }) {
  const [geteilt, setGeteilt] = useState(false);
  const { favoriten } = useApp();
  const gemerkt = favoriten.has(e.id);
  const original = e.links[0];
  const quelleName = original?.quelle ?? (original ? new URL(original.url).hostname.replace(/^www\./, "") : "");
  const route = e.lat != null && e.lng != null ? `https://www.google.com/maps/dir/?api=1&destination=${e.lat},${e.lng}` : null;

  const teilen = async () => {
    const url = window.location.href;
    const text = `${e.titel} – ${e.ortName}`;
    try {
      if (navigator.share) await navigator.share({ title: e.titel, text, url });
      else {
        await navigator.clipboard.writeText(`${text}\n${url}`);
        setGeteilt(true);
        setTimeout(() => setGeteilt(false), 2500);
      }
    } catch {
      /* abgebrochen */
    }
  };

  const zweit = "flex min-h-14 flex-1 flex-col items-center justify-center gap-1 rounded-2xl bg-flaeche px-2 py-2 text-center text-[0.9rem] font-semibold leading-tight ring-1 ring-linie hover:bg-see-zart";

  return (
    <div className="mt-6 flex flex-col gap-3">
      {original && (
        <a
          href={original.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-16 items-center justify-center gap-3 rounded-2xl bg-see px-5 text-lg font-bold text-white shadow-karte transition-transform active:scale-[0.98]"
        >
          <ExternalLink className="h-6 w-6" />
          <span>
            Zur Originalseite
            <span className="block text-[0.85rem] font-normal opacity-90">{quelleName}</span>
          </span>
        </a>
      )}

      <div className="flex items-center gap-3 rounded-2xl bg-flaeche p-3 ring-1 ring-linie">
        <HerzKnopf eventId={e.id} titel={e.titel} gross />
        <div>
          <p className="text-lg font-semibold">{gemerkt ? "Gemerkt" : "Merken"}</p>
          <p className="text-[0.9rem] text-gedaempft">{gemerkt ? "Steht unter „Meine“" : "Erscheint dann unter „Meine“"}</p>
        </div>
      </div>

      <div className="flex gap-3">
        <a href={kalenderLink(e)} target="_blank" rel="noopener noreferrer" className={zweit}>
          <CalendarPlus className="h-6 w-6 text-see" /> In Kalender
        </a>
        {route && (
          <a href={route} target="_blank" rel="noopener noreferrer" className={zweit}>
            <Route className="h-6 w-6 text-see" /> Route
          </a>
        )}
        <button type="button" onClick={teilen} className={zweit}>
          {geteilt ? <Check className="h-6 w-6 text-laerche" /> : <Share2 className="h-6 w-6 text-see" />}
          {geteilt ? "Kopiert" : "Teilen"}
        </button>
      </div>

      {e.links.length > 1 && (
        <div className="mt-2 rounded-2xl bg-flaeche-2 p-4">
          <p className="text-[0.9rem] font-semibold text-gedaempft">Auch zu finden bei:</p>
          <ul className="mt-2 space-y-1">
            {e.links.slice(1).map((l) => (
              <li key={l.url}>
                <a href={l.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-2 font-semibold text-see underline-offset-4 hover:underline">
                  <ExternalLink className="h-4 w-4" /> {l.quelle ?? new URL(l.url).hostname}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
