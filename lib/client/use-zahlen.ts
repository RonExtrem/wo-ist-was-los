"use client";

import { useEffect, useState } from "react";

/**
 * Zahlen pro Land und Bundesland von /api/regionen.
 * Die alten Zahlen bleiben stehen, bis die neuen da sind – sonst würden Knöpfe kurz schmäler und springen.
 */
export function useZahlen(parameter: Record<string, string> | null): Record<string, number> | undefined {
  const schluessel = parameter ? new URLSearchParams(parameter).toString() : null;
  const [zahlen, setZahlen] = useState<Record<string, number>>();
  useEffect(() => {
    if (!schluessel) return;
    const ctrl = new AbortController();
    fetch(`/api/regionen?${schluessel}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { zahlen?: Record<string, number> } | null) => {
        if (d?.zahlen) setZahlen(d.zahlen);
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, [schluessel]);
  return zahlen;
}

/** Zeitpunkt auf die volle Stunde gerundet (für stabile Abfrage-Schlüssel). */
export function aufStunde(d: Date): string {
  return d.toISOString().slice(0, 13) + ":00:00Z";
}
