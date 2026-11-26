"use client";

import { motion, AnimatePresence } from "motion/react";
import { Heart } from "lucide-react";
import { useApp } from "@/lib/client/app-zustand";

/** Merken-Herz mit kleiner Animation. */
export function HerzKnopf({ eventId, titel, gross = false }: { eventId: string; titel: string; gross?: boolean }) {
  const { favoriten, merken } = useApp();
  const an = favoriten.has(eventId);
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.85 }}
      onClick={() => merken(eventId)}
      aria-pressed={an}
      aria-label={an ? `„${titel}“ nicht mehr merken` : `„${titel}“ merken`}
      className={`relative flex shrink-0 items-center justify-center rounded-full transition-colors ${
        gross ? "h-14 w-14" : "h-12 w-12"
      } ${an ? "bg-abendsonne-zart text-abendsonne" : "bg-flaeche-2 text-gedaempft hover:text-abendsonne"}`}
    >
      <AnimatePresence initial={false}>
        {an && (
          <motion.span
            key="ring"
            initial={{ scale: 0.6, opacity: 0.7 }}
            animate={{ scale: 1.6, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0 rounded-full border-2 border-abendsonne"
          />
        )}
      </AnimatePresence>
      <motion.span key={an ? "an" : "aus"} initial={{ scale: an ? 0.4 : 1 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 15 }}>
        <Heart className={gross ? "h-7 w-7" : "h-6 w-6"} fill={an ? "currentColor" : "none"} strokeWidth={2.2} />
      </motion.span>
    </motion.button>
  );
}
