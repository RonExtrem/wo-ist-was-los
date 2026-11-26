"use client";

// Geführte Tour durch die App: Fortschritt im Handy speichern, damit sie auch nach einem Neuladen weiterläuft.
const SCHLUESSEL = "wiwl-tour";
const EREIGNIS = "wiwl-tour";

/** Aktueller Schritt (0 = erster) oder null, wenn keine Tour läuft. */
export function tourSchritt(): number | null {
  try {
    const v = localStorage.getItem(SCHLUESSEL);
    return v == null ? null : Number(v) || 0;
  } catch {
    return null;
  }
}

export function setzeTourSchritt(schritt: number | null) {
  try {
    if (schritt == null) localStorage.removeItem(SCHLUESSEL);
    else localStorage.setItem(SCHLUESSEL, String(schritt));
  } catch {
    /* privater Modus – Tour läuft dann nur bis zum Neuladen nicht weiter */
  }
  window.dispatchEvent(new Event(EREIGNIS));
}

export const tourStarten = () => setzeTourSchritt(0);

export function tourAbo(fn: () => void) {
  window.addEventListener(EREIGNIS, fn);
  window.addEventListener("storage", fn);
  return () => {
    window.removeEventListener(EREIGNIS, fn);
    window.removeEventListener("storage", fn);
  };
}
