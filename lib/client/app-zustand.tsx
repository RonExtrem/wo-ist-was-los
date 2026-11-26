"use client";

// Zentraler Zustand im Browser: Geräte-Schlüssel, Einstellungen, Startpunkt, Favoriten.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { STANDARD_INTERESSEN } from "@/lib/kategorien";

export interface Einstellungen {
  wohnortName: string;
  lat: number;
  lng: number;
  umkreisKm: number;
  interessen: string[];
  schriftgroesse: "normal" | "gross" | "sehr_gross";
  theme: "auto" | "hell" | "dunkel";
}

export interface Startpunkt {
  art: "daheim" | "hier" | "anders";
  name: string;
  lat: number;
  lng: number;
}

const STANDARD: Einstellungen = {
  wohnortName: "Spittal an der Drau",
  lat: 46.7989,
  lng: 13.4955,
  umkreisKm: 50,
  interessen: [...STANDARD_INTERESSEN],
  schriftgroesse: "gross",
  theme: "auto",
};

const SCHLUESSEL = { token: "wiwl-token", einst: "wiwl-einstellungen", start: "wiwl-startpunkt", fav: "wiwl-favoriten" };

function lies<T>(k: string, ersatz: T): T {
  try {
    const v = localStorage.getItem(k);
    return v ? { ...ersatz, ...JSON.parse(v) } : ersatz;
  } catch {
    return ersatz;
  }
}
function schreib(k: string, v: unknown) {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* privater Modus o. ä. */
  }
}

interface AppZustand {
  bereit: boolean;
  einstellungen: Einstellungen;
  setzeEinstellungen: (e: Partial<Einstellungen>) => void;
  startpunkt: Startpunkt;
  setzeStartpunkt: (s: Startpunkt) => void;
  favoriten: Set<string>;
  merken: (eventId: string) => void;
  api: (pfad: string, init?: RequestInit) => Promise<Response>;
}

const Ctx = createContext<AppZustand | null>(null);

export function AppZustandProvider({ children }: { children: ReactNode }) {
  const [bereit, setBereit] = useState(false);
  const [einstellungen, setEinst] = useState<Einstellungen>(STANDARD);
  const [startpunkt, setStart] = useState<Startpunkt>({ art: "daheim", name: STANDARD.wohnortName, lat: STANDARD.lat, lng: STANDARD.lng });
  const [favoriten, setFav] = useState<Set<string>>(new Set());
  const tokenRef = useRef<string | null>(null);
  const tokenPromise = useRef<Promise<string | null> | null>(null);

  const holeToken = useCallback(async (): Promise<string | null> => {
    if (tokenRef.current) return tokenRef.current;
    if (!tokenPromise.current) {
      tokenPromise.current = (async () => {
        try {
          const vorhanden = localStorage.getItem(SCHLUESSEL.token);
          if (vorhanden) return (tokenRef.current = vorhanden);
          const res = await fetch("/api/geraet", { method: "POST" });
          if (!res.ok) return null;
          const { token } = (await res.json()) as { token: string };
          localStorage.setItem(SCHLUESSEL.token, token);
          return (tokenRef.current = token);
        } catch {
          return null;
        }
      })();
    }
    return tokenPromise.current;
  }, []);

  const api = useCallback(
    async (pfad: string, init: RequestInit = {}) => {
      const token = await holeToken();
      const headers = new Headers(init.headers);
      if (token) headers.set("x-geraet", token);
      if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
      return fetch(pfad, { ...init, headers });
    },
    [holeToken]
  );

  // Beim Start: gespeicherte Werte laden, Favoriten vom Server holen
  useEffect(() => {
    const e = lies(SCHLUESSEL.einst, STANDARD);
    // Einmaliges Übernehmen der im Handy gespeicherten Werte nach dem ersten Zeichnen (vermeidet Hydration-Fehler)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEinst(e);
    const s = lies<Startpunkt>(SCHLUESSEL.start, { art: "daheim", name: e.wohnortName, lat: e.lat, lng: e.lng });
    setStart(s.art === "daheim" ? { art: "daheim", name: e.wohnortName, lat: e.lat, lng: e.lng } : s);
    try {
      setFav(new Set(JSON.parse(localStorage.getItem(SCHLUESSEL.fav) ?? "[]")));
    } catch {
      /* egal */
    }
    setBereit(true);
    api("/api/favoriten")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { ids: string[] } | null) => {
        if (d) {
          setFav(new Set(d.ids));
          schreib(SCHLUESSEL.fav, d.ids);
        }
      })
      .catch(() => {});
  }, [api]);

  // Schriftgröße und Hell/Dunkel auf die ganze Seite anwenden
  useEffect(() => {
    const html = document.documentElement;
    html.dataset.schrift = einstellungen.schriftgroesse;
    if (einstellungen.theme === "auto") delete html.dataset.theme;
    else html.dataset.theme = einstellungen.theme === "hell" ? "light" : "dark";
  }, [einstellungen.schriftgroesse, einstellungen.theme]);

  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setzeEinstellungen = useCallback(
    (teil: Partial<Einstellungen>) => {
      setEinst((alt) => {
        const neu = { ...alt, ...teil };
        schreib(SCHLUESSEL.einst, neu);
        if (syncTimer.current) clearTimeout(syncTimer.current);
        syncTimer.current = setTimeout(() => {
          api("/api/einstellungen", { method: "PUT", body: JSON.stringify(neu) }).catch(() => {});
        }, 800);
        if (teil.lat != null || teil.wohnortName) {
          setStart((s) => (s.art === "daheim" ? { art: "daheim", name: neu.wohnortName, lat: neu.lat, lng: neu.lng } : s));
        }
        return neu;
      });
    },
    [api]
  );

  const setzeStartpunkt = useCallback((s: Startpunkt) => {
    setStart(s);
    schreib(SCHLUESSEL.start, s);
  }, []);

  const merken = useCallback(
    (eventId: string) => {
      setFav((alt) => {
        const neu = new Set(alt);
        const istDrin = neu.has(eventId);
        if (istDrin) neu.delete(eventId);
        else neu.add(eventId);
        schreib(SCHLUESSEL.fav, [...neu]);
        const anfrage = istDrin
          ? api(`/api/favoriten?eventId=${eventId}`, { method: "DELETE" })
          : api("/api/favoriten", { method: "POST", body: JSON.stringify({ eventId }) });
        anfrage.catch(() => {});
        return neu;
      });
    },
    [api]
  );

  const wert = useMemo(
    () => ({ bereit, einstellungen, setzeEinstellungen, startpunkt, setzeStartpunkt, favoriten, merken, api }),
    [bereit, einstellungen, setzeEinstellungen, startpunkt, setzeStartpunkt, favoriten, merken, api]
  );
  return <Ctx.Provider value={wert}>{children}</Ctx.Provider>;
}

export function useApp(): AppZustand {
  const c = useContext(Ctx);
  if (!c) throw new Error("useApp außerhalb von AppZustandProvider");
  return c;
}
