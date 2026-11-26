"use client";

// Geführte Tour: hebt echte Knöpfe hervor (Rest abgedunkelt) und erklärt sie. Bei Mitmach-Schritten tippt man selbst.
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "motion/react";
import { ChevronLeft, ChevronRight, Hand, X } from "lucide-react";
import { setzeTourSchritt, tourAbo, tourSchritt } from "@/lib/client/tour";
import { useApp } from "@/lib/client/app-zustand";
import { TOUR } from "./tour-schritte";

interface Rahmen {
  top: number;
  left: number;
  width: number;
  height: number;
}

const RAND = 8; // Luft um das hervorgehobene Element

export function Tour() {
  const schritt = useSyncExternalStore(tourAbo, tourSchritt, () => null);
  if (schritt == null || schritt >= TOUR.length) return null;
  return <TourSchrittAnzeige key={schritt} nr={schritt} />;
}

function TourSchrittAnzeige({ nr }: { nr: number }) {
  const s = TOUR[nr];
  const pfad = usePathname();
  const router = useRouter();
  const { zeigeHinweis } = useApp();
  const [rahmen, setRahmen] = useState<Rahmen | null>(null);
  const [gesucht, setGesucht] = useState(false);
  const [fenster, setFenster] = useState({ w: 0, h: 0 });
  const richtigeSeite = pfad === s.seite;

  const beenden = useCallback(
    (fertig: boolean) => {
      setzeTourSchritt(null);
      zeigeHinweis(fertig ? "Tour fertig 🎉 Du findest sie jederzeit in den Einstellungen." : "Tour beendet – starten kannst du sie jederzeit in den Einstellungen.");
    },
    [zeigeHinweis]
  );
  const weiter = useCallback(() => {
    if (nr + 1 >= TOUR.length) beenden(true);
    else setzeTourSchritt(nr + 1);
  }, [nr, beenden]);

  // Auf die richtige Seite wechseln (außer bei Mitmach-Schritten – dort wechselt man selbst)
  useEffect(() => {
    if (!richtigeSeite && !(s.tippen && pfad === s.tippen.weiterBei)) router.push(s.seite);
  }, [richtigeSeite, s, pfad, router]);

  // Mitmach-Schritt geschafft: man ist auf der Zielseite gelandet
  useEffect(() => {
    if (s.tippen && pfad === s.tippen.weiterBei) weiter();
  }, [pfad, s.tippen, weiter]);

  // Ziel suchen, ins Bild holen und laufend nachmessen (Inhalte laden nach, Seite scrollt …)
  useEffect(() => {
    if (!richtigeSeite) return;
    let gescrollt = false;
    const start = Date.now();
    const messen = () => {
      setFenster({ w: window.innerWidth, h: window.innerHeight });
      if (!s.ziel) {
        setRahmen(null);
        setGesucht(true);
        return;
      }
      const el = document.querySelector(s.ziel);
      if (!el) {
        if (Date.now() - start > 4000) setGesucht(true); // nicht da (z. B. noch nichts geladen) → Fenster in der Mitte
        return;
      }
      if (!gescrollt) {
        gescrollt = true;
        el.scrollIntoView({ block: "center", behavior: "smooth" });
      }
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return;
      setRahmen({ top: r.top - RAND, left: r.left - RAND, width: r.width + 2 * RAND, height: r.height + 2 * RAND });
      setGesucht(true);
    };
    const erstes = requestAnimationFrame(messen);
    const t = setInterval(messen, 250);
    window.addEventListener("resize", messen);
    return () => {
      cancelAnimationFrame(erstes);
      clearInterval(t);
      window.removeEventListener("resize", messen);
    };
  }, [richtigeSeite, s.ziel]);

  if (!richtigeSeite || !gesucht) {
    // Während des Seitenwechsels nur abdunkeln und Tippen sperren
    return <div className="fixed inset-0 z-[80] bg-[rgba(4,18,22,0.55)]" aria-hidden />;
  }

  // Erklärfenster unter oder über dem Ziel – wo mehr Platz ist
  const platzUnten = rahmen ? fenster.h - (rahmen.top + rahmen.height) : 0;
  const platzOben = rahmen ? rahmen.top : 0;
  const karteUnten = rahmen ? platzUnten >= platzOben : null;
  // Äußere Hülle positioniert (ohne Animation), innen wird nur eingeblendet – sonst überschreibt die Animation die Lage
  const kartenStil: React.CSSProperties = !rahmen
    ? { top: 0, bottom: 0 }
    : karteUnten
      ? { top: rahmen.top + rahmen.height + 12 }
      : { bottom: fenster.h - rahmen.top + 12 };

  const sperre = "fixed z-[80] pointer-events-auto";
  return (
    <>
      {/* Abdunkeln mit Loch um das Ziel */}
      {rahmen ? (
        <motion.div
          aria-hidden
          className={`pointer-events-none fixed z-[80] rounded-2xl ring-[3px] ring-see ${s.tippen ? "tour-puls" : ""}`}
          initial={false}
          animate={{ top: rahmen.top, left: rahmen.left, width: rahmen.width, height: rahmen.height }}
          transition={{ type: "spring", stiffness: 400, damping: 40 }}
          style={{ boxShadow: "0 0 0 200vmax rgba(4,18,22,0.72)" }}
        />
      ) : (
        <div aria-hidden className="pointer-events-none fixed inset-0 z-[80] bg-[rgba(4,18,22,0.72)]" />
      )}

      {/* Tippen sperren – bei Mitmach-Schritten bleibt das Ziel frei */}
      {rahmen && s.tippen ? (
        <>
          <div className={sperre} style={{ top: 0, left: 0, right: 0, height: Math.max(rahmen.top, 0) }} />
          <div className={sperre} style={{ top: rahmen.top + rahmen.height, left: 0, right: 0, bottom: 0 }} />
          <div className={sperre} style={{ top: rahmen.top, left: 0, width: Math.max(rahmen.left, 0), height: rahmen.height }} />
          <div className={sperre} style={{ top: rahmen.top, left: rahmen.left + rahmen.width, right: 0, height: rahmen.height }} />
        </>
      ) : (
        <div className={`${sperre} inset-0`} />
      )}

      {/* Erklärfenster */}
      <div className="pointer-events-none fixed inset-x-4 z-[81] flex items-center justify-center" style={kartenStil}>
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label={s.titel}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="pointer-events-auto w-full max-w-md rounded-3xl bg-flaeche p-5 text-foreground shadow-2xl ring-1 ring-linie"
        >
          <div className="flex items-center gap-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-flaeche-2" aria-label={`Schritt ${nr + 1} von ${TOUR.length}`}>
              <div className="h-full rounded-full bg-see transition-all" style={{ width: `${((nr + 1) / TOUR.length) * 100}%` }} />
            </div>
            <span className="text-[0.85rem] font-semibold text-gedaempft">
              {nr + 1}/{TOUR.length}
            </span>
            <button
              type="button"
              onClick={() => beenden(false)}
              aria-label="Tour beenden"
              className="-my-2 -mr-2 flex h-11 w-11 items-center justify-center rounded-full text-gedaempft hover:bg-flaeche-2"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          <h2 className="mt-2 font-titel text-[1.45rem] leading-tight">{s.titel}</h2>
          <p className="mt-2 text-[1.02rem] leading-relaxed">{s.text}</p>

          {s.tippen ? (
            <div className="mt-4">
              <p className="flex min-h-12 items-center gap-2 rounded-2xl bg-see-zart px-4 font-bold text-see">
                <Hand className="h-6 w-6 shrink-0 animate-bounce" /> {s.tippen.hinweis}
              </p>
              <button
                type="button"
                onClick={() => router.push(s.tippen!.weiterBei)}
                className="mt-1 min-h-11 text-[0.95rem] font-semibold text-gedaempft"
              >
                Weiter ohne Tippen →
              </button>
            </div>
          ) : (
            <div className="mt-4 flex gap-2">
              {nr > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    // Zurück über Mitmach-Schritte hinweg: auf den vorherigen erklärenden Schritt
                    let z = nr - 1;
                    while (z > 0 && TOUR[z].tippen) z--;
                    setzeTourSchritt(z);
                  }}
                  aria-label="Zurück"
                  className="flex min-h-12 w-14 items-center justify-center rounded-2xl bg-flaeche-2"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
              )}
              <button
                type="button"
                onClick={weiter}
                className="flex min-h-12 flex-1 items-center justify-center gap-1 rounded-2xl bg-see text-lg font-bold text-white"
              >
                {nr === 0 ? "Los geht's" : nr + 1 === TOUR.length ? "Fertig" : "Weiter"}
                {nr + 1 < TOUR.length && <ChevronRight className="h-5 w-5" />}
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </>
  );
}
