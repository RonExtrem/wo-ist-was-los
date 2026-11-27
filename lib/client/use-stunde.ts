"use client";

import { useEffect, useState } from "react";

function jetztStunde(): string {
  return new Date().toISOString().slice(0, 13);
}

/**
 * Aktuelle Stunde als Schlüssel (z. B. „2026-11-26T19"), leer bis zum ersten Messen im Browser.
 * Ändert sich zur vollen Stunde und beim Zurückkehren in die App – so rechnen „Heute & morgen",
 * „Wochenende" usw. neu, auch wenn das Handy die App über Nacht im Speicher behalten hat.
 */
export function useStunde(): string {
  const [stunde, setStunde] = useState("");
  useEffect(() => {
    const pruefen = () => setStunde(jetztStunde());
    const erstes = requestAnimationFrame(pruefen);
    const takt = setInterval(pruefen, 60_000);
    const sichtbar = () => {
      if (document.visibilityState === "visible") pruefen();
    };
    document.addEventListener("visibilitychange", sichtbar);
    window.addEventListener("focus", pruefen);
    return () => {
      cancelAnimationFrame(erstes);
      clearInterval(takt);
      document.removeEventListener("visibilitychange", sichtbar);
      window.removeEventListener("focus", pruefen);
    };
  }, []);
  return stunde;
}
