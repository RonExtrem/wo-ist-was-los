"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { ArrowLeft, BellOff, BellRing, CalendarPlus, ExternalLink, Route, Share2, Check } from "lucide-react";
import { pushEinschalten, pushMoeglich, pushStatus } from "@/lib/client/push";
import type { EventDetail } from "@/lib/event-typ";
import { useApp } from "@/lib/client/app-zustand";
import { HerzKnopf } from "@/components/HerzKnopf";
import { KategorieBild } from "@/components/KategorieBild";

/** Name der Webseite aus einem Link – ein kaputter Link (z. B. selbst eingetragen) darf die Seite nicht abstürzen lassen. */
function hostVon(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "Originalseite";
  }
}

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
  const { favoriten, merken, ohneErinnerung, setzeErinnerung, einstellungen, setzeEinstellungen, zeigeHinweis, api } = useApp();
  const gemerkt = favoriten.has(e.id);
  const mitErinnerung = einstellungen.erinnern && !ohneErinnerung.has(e.id);

  const erinnerungUmschalten = async () => {
    if (mitErinnerung) {
      setzeErinnerung(e.id, false);
      zeigeHinweis("Erinnerung ist aus – bleibt aber gemerkt.");
      return;
    }
    if (pushMoeglich() && (await pushStatus().catch(() => "aus" as const)) !== "an") {
      const s = await pushEinschalten(api).catch(() => "aus" as const);
      if (s !== "an") {
        zeigeHinweis(
          s === "blockiert"
            ? "Benachrichtigungen sind am Handy gesperrt – bitte in den Handy-Einstellungen erlauben."
            : "Benachrichtigungen konnten nicht eingeschaltet werden – bitte gleich nochmal probieren."
        );
        return;
      }
    }
    // Erst wenn Benachrichtigungen wirklich gehen, Erinnerungen allgemein einschalten
    if (!einstellungen.erinnern) setzeEinstellungen({ erinnern: true });
    setzeErinnerung(e.id, true);
    zeigeHinweis("Erinnerung ist eingestellt ✓");
  };
  const original = e.links[0];
  const quelleName = original?.quelle ?? (original ? hostVon(original.url) : "");
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

      {/* Die ganze Fläche ist der Knopf – nicht nur das Herz */}
      <motion.button
        type="button"
        whileTap={{ scale: 0.98 }}
        onClick={() => merken(e.id)}
        aria-pressed={gemerkt}
        className={`flex min-h-20 w-full items-center gap-3 rounded-2xl p-3 text-left ring-1 transition-colors ${
          gemerkt ? "bg-abendsonne-zart/60 ring-abendsonne/40" : "bg-flaeche ring-linie hover:bg-see-zart"
        }`}
      >
        <HerzKnopf eventId={e.id} titel={e.titel} gross nurSymbol />
        <span>
          <span className="block text-lg font-semibold">{gemerkt ? "Gemerkt" : "Merken"}</span>
          <span className="block text-[0.9rem] text-gedaempft">
            {gemerkt ? "Steht unter „Meine“ – nochmal tippen zum Entfernen" : "Erscheint dann unter „Meine“"}
          </span>
        </span>
      </motion.button>

      {gemerkt && (
        <button
          type="button"
          onClick={erinnerungUmschalten}
          aria-pressed={mitErinnerung}
          className={`-mt-1 flex min-h-14 w-full items-center gap-3 rounded-2xl px-4 text-left ring-1 transition-colors ${
            mitErinnerung ? "bg-see-zart ring-see/40" : "bg-flaeche ring-linie"
          }`}
        >
          {mitErinnerung ? <BellRing className="h-6 w-6 shrink-0 text-see" /> : <BellOff className="h-6 w-6 shrink-0 text-gedaempft" />}
          <span>
            <span className="block font-semibold">{mitErinnerung ? "Erinnerung ist an" : "Keine Erinnerung"}</span>
            <span className="block text-[0.9rem] text-gedaempft">
              {mitErinnerung ? "Vortag ca. 18 Uhr und am Tag ca. 8 Uhr – antippen zum Abschalten" : "Antippen, um doch erinnert zu werden"}
            </span>
          </span>
        </button>
      )}

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
                  <ExternalLink className="h-4 w-4" /> {l.quelle ?? hostVon(l.url)}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
