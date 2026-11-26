"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { House, Search, Map, Heart } from "lucide-react";

const PUNKTE = [
  { href: "/", text: "Start", Icon: House },
  { href: "/suchen", text: "Suchen", Icon: Search },
  { href: "/karte", text: "Karte", Icon: Map },
  { href: "/meine", text: "Meine", Icon: Heart },
];

/** Große Leiste unten – mit dem Daumen gut erreichbar. */
export function LeisteUnten() {
  const pfad = usePathname();
  const aktiv = (href: string) => (href === "/" ? pfad === "/" : pfad.startsWith(href));

  return (
    <nav
      aria-label="Hauptbereiche"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-linie bg-flaeche/95 backdrop-blur-md"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto grid max-w-xl grid-cols-4">
        {PUNKTE.map(({ href, text, Icon }) => {
          const an = aktiv(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={an ? "page" : undefined}
                className={`relative flex min-h-[4.25rem] flex-col items-center justify-center gap-1 text-[0.95rem] font-semibold transition-colors ${
                  an ? "text-see" : "text-gedaempft"
                }`}
              >
                {an && (
                  <motion.span
                    layoutId="leiste-markierung"
                    className="absolute inset-x-4 top-0 h-1 rounded-b-full bg-see"
                    transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  />
                )}
                <Icon aria-hidden className="h-7 w-7" strokeWidth={an ? 2.4 : 2} fill={an && href === "/meine" ? "currentColor" : "none"} />
                {text}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
