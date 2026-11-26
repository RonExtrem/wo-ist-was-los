"use client";

import { AnimatePresence, motion } from "motion/react";
import { useApp } from "@/lib/client/app-zustand";

/** Kurze Bestätigung unten (z. B. „Gemerkt ♥ Erinnerung kommt …“), verschwindet nach ein paar Sekunden. */
export function HinweisLeiste() {
  const { hinweis } = useApp();
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 z-50 flex justify-center px-4"
      style={{ bottom: "calc(env(safe-area-inset-bottom) + 5.5rem)" }}
    >
      <AnimatePresence>
        {hinweis && (
          <motion.p
            key={hinweis.id}
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10 }}
            className="max-w-md rounded-2xl bg-foreground px-5 py-3 text-center text-[1rem] font-semibold text-background shadow-karte"
          >
            {hinweis.text}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
