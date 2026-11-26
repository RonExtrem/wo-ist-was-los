"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { BellRing, Heart } from "lucide-react";
import { useApp } from "@/lib/client/app-zustand";
import { pushEinschalten, pushMoeglich } from "@/lib/client/push";

/** Nach dem Herz: „Soll ich dich erinnern?“ – Ja / Nein, nur merken. Eigener Dialog, kein Browser-Popup. */
export function ErinnerungsFrage() {
  const { frageFuer, schliesseFrage, setzeErinnerung, setzeEinstellungen, zeigeHinweis, api } = useApp();
  const [nichtMehrFragen, setNichtMehrFragen] = useState(false);
  const [laeuft, setLaeuft] = useState(false);
  const [blockiert, setBlockiert] = useState(false);

  const fertig = () => {
    setNichtMehrFragen(false);
    setBlockiert(false);
    schliesseFrage();
  };

  const ja = async () => {
    if (!frageFuer) return;
    setLaeuft(true);
    // Benachrichtigungen noch nicht erlaubt? Dann jetzt einschalten (das Handy fragt einmal nach)
    if (pushMoeglich() && Notification.permission !== "granted") {
      const s = await pushEinschalten(api).catch(() => "aus" as const);
      if (s === "blockiert") {
        setLaeuft(false);
        setBlockiert(true);
        return;
      }
    }
    setLaeuft(false);
    setzeErinnerung(frageFuer, true);
    if (nichtMehrFragen) setzeEinstellungen({ erinnerungFragen: false });
    zeigeHinweis(
      pushMoeglich()
        ? "Erinnerung ist eingestellt ✓ Vortag ca. 18 Uhr und am Tag ca. 8 Uhr."
        : "Gemerkt ♥ Auf diesem Gerät gehen leider keine Benachrichtigungen."
    );
    fertig();
  };

  const nein = () => {
    if (nichtMehrFragen) setzeEinstellungen({ erinnern: false, erinnerungFragen: false });
    zeigeHinweis("Gemerkt ♥ ohne Erinnerung. Du findest es unter „Meine“.");
    fertig();
  };

  return (
    <AnimatePresence>
      {frageFuer && (
        <motion.div
          key="erinnerungs-frage"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end bg-black/40"
          onClick={nein}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="erinnerungs-frage-titel"
            initial={{ y: 60 }}
            animate={{ y: 0 }}
            exit={{ y: 60 }}
            onClick={(e) => e.stopPropagation()}
            className="mx-auto w-full max-w-xl rounded-t-[2rem] bg-flaeche px-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-6 shadow-karte"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-abendsonne-zart text-abendsonne">
              <Heart className="h-7 w-7" fill="currentColor" />
            </span>
            <h2 id="erinnerungs-frage-titel" className="font-titel mt-3 text-2xl">
              Gemerkt! Soll ich dich erinnern?
            </h2>
            <p className="mt-2 text-gedaempft">
              Dann kommt am Vortag um ca. 18 Uhr und am Tag selbst um ca. 8 Uhr eine kurze Nachricht.
            </p>
            {blockiert && (
              <p className="mt-3 rounded-2xl bg-abendsonne-zart p-3 font-semibold text-abendsonne">
                Benachrichtigungen sind am Handy für diese App gesperrt. Erlauben kannst du sie in den Handy-Einstellungen → Apps → „Wo is wos
                los?“ → Benachrichtigungen.
              </p>
            )}
            <div className="mt-5 flex flex-col gap-3">
              <button
                type="button"
                onClick={ja}
                disabled={laeuft}
                className="flex min-h-16 items-center justify-center gap-3 rounded-2xl bg-see text-lg font-bold text-white shadow-karte disabled:opacity-60"
              >
                <BellRing className="h-6 w-6" />
                {laeuft ? "Einen Moment …" : "Ja, erinnere mich"}
              </button>
              <button
                type="button"
                onClick={nein}
                className="flex min-h-14 items-center justify-center rounded-2xl bg-flaeche-2 text-lg font-semibold ring-1 ring-linie"
              >
                Nein, nur merken
              </button>
              <label className="mt-1 flex min-h-12 cursor-pointer items-center justify-center gap-3 text-[0.95rem] text-gedaempft">
                <input
                  type="checkbox"
                  checked={nichtMehrFragen}
                  onChange={(e) => setNichtMehrFragen(e.target.checked)}
                  className="h-6 w-6 accent-[var(--see)]"
                />
                Nicht mehr fragen – immer so machen
              </label>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
