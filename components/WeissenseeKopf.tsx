"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { motion } from "motion/react";
import { Settings } from "lucide-react";
import { begruessung, heuteText, wienStunde } from "@/lib/datum";
import { useApp } from "@/lib/client/app-zustand";

type Tageszeit = "morgen" | "tag" | "abend" | "nacht";

// Himmel und See färben sich je nach Tageszeit – wie am Weißensee
const HIMMEL: Record<Tageszeit, { oben: string; unten: string; sonne: string; see: string; berg1: string; berg2: string; berg3: string }> = {
  morgen: { oben: "#7fc4d0", unten: "#f7d9b5", sonne: "#f4a35c", see: "#1c8f98", berg1: "#5c8c86", berg2: "#3f6f68", berg3: "#2d554f" },
  tag: { oben: "#3aa7b4", unten: "#bfe6e6", sonne: "#fde7a8", see: "#0e8b95", berg1: "#4f8a7d", berg2: "#376e62", berg3: "#25544a" },
  abend: { oben: "#2f5f7a", unten: "#f0a070", sonne: "#e8743a", see: "#145f6c", berg1: "#3e5d63", berg2: "#2b474e", berg3: "#1c353b" },
  nacht: { oben: "#0b1f2b", unten: "#14404c", sonne: "#e9eef0", see: "#0b3b45", berg1: "#183238", berg2: "#11262b", berg3: "#0b1a1e" },
};

function tageszeit(): Tageszeit {
  const h = wienStunde();
  if (h >= 6 && h < 10) return "morgen";
  if (h >= 10 && h < 17) return "tag";
  if (h >= 17 && h < 21) return "abend";
  return "nacht";
}

const keinAbo = () => () => {};

export function WeissenseeKopf({ kinder }: { kinder?: React.ReactNode }) {
  // Auf dem Server neutral („Tag“, „Servus“), im Browser die echte Tageszeit
  const zeit = useSyncExternalStore(keinAbo, tageszeit, () => "tag" as Tageszeit);
  const grussText = useSyncExternalStore(keinAbo, begruessung, () => "Servus");
  const datum = useSyncExternalStore(keinAbo, heuteText, () => "");
  const { einstellungen } = useApp();
  const name = einstellungen.name.trim();
  const gruss = { text: name ? `${grussText}, ${name}` : grussText, datum };
  const f = HIMMEL[zeit];

  return (
    <header className="relative overflow-hidden text-white" style={{ background: `linear-gradient(180deg, ${f.oben} 0%, ${f.unten} 78%)`, transition: "background 1s" }}>
      {/* Landschaft: Sonne/Mond, drei Bergketten, See mit Glitzern */}
      <svg aria-hidden viewBox="0 0 400 220" preserveAspectRatio="xMidYMax slice" className="absolute inset-0 h-full w-full">
        <motion.circle cx="255" cy="78" r="18" fill={f.sonne} initial={{ cy: 100, opacity: 0 }} animate={{ cy: 78, opacity: 0.95 }} transition={{ duration: 1.4, ease: "easeOut" }} />
        <path d="M0 150 L40 112 L70 128 L120 84 L160 118 L205 92 L250 126 L300 98 L345 122 L400 104 L400 220 L0 220 Z" fill={f.berg1} opacity="0.75" />
        <path d="M0 165 L55 128 L95 146 L150 112 L200 150 L240 130 L290 156 L340 132 L400 150 L400 220 L0 220 Z" fill={f.berg2} />
        <path d="M0 176 L70 154 L130 168 L190 148 L250 170 L320 152 L400 168 L400 220 L0 220 Z" fill={f.berg3} />
        <rect x="0" y="178" width="400" height="42" fill={f.see} />
        <g stroke="white" strokeLinecap="round" strokeWidth="2">
          <line className="glitzer" x1="40" y1="192" x2="90" y2="192" />
          <line className="glitzer" style={{ animationDelay: "1.2s" }} x1="210" y1="200" x2="260" y2="200" />
          <line className="glitzer" style={{ animationDelay: "2.4s" }} x1="300" y1="188" x2="330" y2="188" />
          <line className="glitzer" style={{ animationDelay: "3.1s" }} x1="120" y1="208" x2="150" y2="208" />
        </g>
      </svg>
      <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-b from-transparent to-background" />

      <div className="relative mx-auto max-w-xl px-5 pb-24 pt-[calc(env(safe-area-inset-top)+1.25rem)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <motion.p initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="text-lg font-semibold drop-shadow-sm">
              {gruss.text}! {gruss.datum && <span className="font-normal opacity-90">· {gruss.datum}</span>}
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="font-titel mt-1 text-[2.4rem] leading-none drop-shadow"
            >
              Wo is wos los?
            </motion.h1>
          </div>
          <Link
            href="/einstellungen"
            aria-label="Einstellungen"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm transition-colors hover:bg-white/30"
          >
            <Settings className="h-6 w-6" />
          </Link>
        </div>
        {kinder}
      </div>
    </header>
  );
}
