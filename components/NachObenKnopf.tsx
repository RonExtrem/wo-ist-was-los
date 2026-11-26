"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUp, SlidersHorizontal } from "lucide-react";

/** Erscheint nach längerem Scrollen – ein Tipp und man ist wieder oben (auf „Suchen“: bei den Filtern). */
export function NachObenKnopf() {
  const pfad = usePathname();
  const [sichtbar, setSichtbar] = useState(false);

  useEffect(() => {
    const pruefen = () => setSichtbar(window.scrollY > 900);
    pruefen();
    window.addEventListener("scroll", pruefen, { passive: true });
    return () => window.removeEventListener("scroll", pruefen);
  }, [pfad]);

  const aufSuche = pfad.startsWith("/suchen");
  const Icon = aufSuche ? SlidersHorizontal : ArrowUp;

  return (
    <AnimatePresence>
      {sichtbar && (
        <motion.button
          key="nach-oben"
          type="button"
          initial={{ opacity: 0, y: 16, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.9 }}
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed right-4 z-40 flex min-h-14 items-center gap-2 rounded-full bg-see px-5 text-[1rem] font-bold text-white shadow-karte ring-2 ring-white/70"
          style={{ bottom: "calc(env(safe-area-inset-bottom) + 5.25rem)" }}
        >
          <Icon aria-hidden className="h-5 w-5" />
          {aufSuche ? "Filter ändern" : "Nach oben"}
        </motion.button>
      )}
    </AnimatePresence>
  );
}
