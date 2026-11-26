import { Store, Music, PartyPopper, Wine, Gift, Guitar, Drama, Trophy, Baby, Car, Mountain, Sparkles, type LucideIcon } from "lucide-react";
import { KATEGORIEN } from "@/lib/kategorien";

export const KATEGORIE_ICON: Record<string, LucideIcon> = {
  "messen-maerkte": Store,
  "schlager-volksmusik": Music,
  "feste-brauchtum": PartyPopper,
  "kulinarik-wein": Wine,
  advent: Gift,
  "pop-rock-party": Guitar,
  "klassik-kultur": Drama,
  sport: Trophy,
  "familie-kinder": Baby,
  "oldtimer-technik": Car,
  "natur-ausfluege": Mountain,
  sonstiges: Sparkles,
};

export function kategorieInfo(id: string) {
  return KATEGORIEN.find((k) => k.id === id) ?? KATEGORIEN[KATEGORIEN.length - 1];
}

/** Ersatzbild, wenn ein Event kein Foto hat: Farbfläche mit Kategorie-Symbol und sanftem Berg-Motiv. */
export function KategorieBild({ kategorie, className = "" }: { kategorie: string; className?: string }) {
  const info = kategorieInfo(kategorie);
  const Icon = KATEGORIE_ICON[info.id] ?? Sparkles;
  return (
    <div
      aria-hidden
      className={`relative flex items-center justify-center overflow-hidden ${className}`}
      style={{ background: `linear-gradient(150deg, ${info.farbe} 0%, color-mix(in oklab, ${info.farbe} 70%, black) 100%)` }}
    >
      <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 h-1/3 w-full opacity-25">
        <path d="M0 40 L0 28 L18 14 L30 24 L46 8 L62 26 L76 16 L100 30 L100 40 Z" fill="white" />
      </svg>
      <Icon className="relative h-1/2 w-1/2 max-h-12 max-w-12 text-white drop-shadow" strokeWidth={1.75} />
    </div>
  );
}
