"use client";

// Zentraler Zustand im Browser: Geräte-Schlüssel, Einstellungen, Startpunkt, Favoriten.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { STANDARD_INTERESSEN } from "@/lib/kategorien";
import { pushAboErneuern, pushMoeglich } from "./push";

export interface Einstellungen {
  /** Vorname – jedes Handy ist das Profil einer Person */
  name: string;
  /** Begrüßung beim ersten Start erledigt? */
  eingerichtet: boolean;
  wohnortName: string;
  lat: number;
  lng: number;
  umkreisKm: number;
  interessen: string[];
  schriftgroesse: "normal" | "gross" | "sehr_gross";
  theme: "auto" | "hell" | "dunkel";
  /** Wie Veranstaltungen angezeigt werden: große Karten, Kacheln (2 nebeneinander) oder kompakte Liste */
  ansicht: Ansicht;
  /** Push: an gemerkte Veranstaltungen erinnern (Vortag + am Tag) */
  erinnern: boolean;
  /** Beim Merken jedes Mal fragen: erinnern oder nur merken? */
  erinnerungFragen: boolean;
  /** „Nur merken – nicht mehr fragen“: neue Herzen ohne Erinnerung (bisherige Erinnerungen bleiben) – nur auf dem Handy */
  neueOhneErinnerung?: boolean;
  /** Push „Neu für dich“: täglich, seltener (2× pro Woche) oder aus */
  neuFuerDich: "taeglich" | "seltener" | "aus";
  /** Push am Donnerstag: Wochenend-Tipp */
  wochenendTipp: boolean;
}

export type Ansicht = "gross" | "kacheln" | "liste";

export interface Startpunkt {
  art: "daheim" | "hier" | "anders";
  name: string;
  lat: number;
  lng: number;
}

const STANDARD: Einstellungen = {
  name: "",
  eingerichtet: false,
  wohnortName: "Spittal an der Drau",
  lat: 46.7989,
  lng: 13.4955,
  umkreisKm: 50,
  interessen: [...STANDARD_INTERESSEN],
  schriftgroesse: "gross",
  theme: "auto",
  ansicht: "gross",
  erinnern: true,
  erinnerungFragen: true,
  neuFuerDich: "taeglich",
  wochenendTipp: true,
};

const SCHLUESSEL = {
  token: "wiwl-token",
  einst: "wiwl-einstellungen",
  start: "wiwl-startpunkt",
  fav: "wiwl-favoriten",
  ohneErinnerung: "wiwl-ohne-erinnerung",
};

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
  /** Nach dem ersten Herz einmal fragen, ob erinnert werden soll */
  /** Gemerkte Veranstaltungen, an die NICHT erinnert werden soll */
  ohneErinnerung: Set<string>;
  setzeErinnerung: (eventId: string, an: boolean) => void;
  /** Nach dem Herz: Frage „erinnern oder nur merken?“ für dieses Event */
  frageFuer: string | null;
  schliesseFrage: () => void;
  /** Kurze Bestätigung unten am Bildschirm (z. B. nach dem Merken) */
  hinweis: { id: number; text: string } | null;
  zeigeHinweis: (text: string) => void;
}

const Ctx = createContext<AppZustand | null>(null);

export function AppZustandProvider({ children }: { children: ReactNode }) {
  const [bereit, setBereit] = useState(false);
  const [einstellungen, setEinst] = useState<Einstellungen>(STANDARD);
  const [startpunkt, setStart] = useState<Startpunkt>({ art: "daheim", name: STANDARD.wohnortName, lat: STANDARD.lat, lng: STANDARD.lng });
  const [favoriten, setFav] = useState<Set<string>>(new Set());
  const favoritenRef = useRef(favoriten);
  useEffect(() => {
    favoritenRef.current = favoriten;
  }, [favoriten]);
  const [frageFuer, setFrageFuer] = useState<string | null>(null);
  const [ohneErinnerung, setOhne] = useState<Set<string>>(new Set());
  const [hinweis, setHinweis] = useState<{ id: number; text: string } | null>(null);
  const hinweisTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const zeigeHinweis = useCallback((text: string) => {
    if (hinweisTimer.current) clearTimeout(hinweisTimer.current);
    setHinweis({ id: Date.now(), text });
    hinweisTimer.current = setTimeout(() => setHinweis(null), 4000);
  }, []);
  const einstRef = useRef<Einstellungen>(STANDARD);
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
          if (!res.ok) throw new Error(String(res.status));
          const { token } = (await res.json()) as { token: string };
          localStorage.setItem(SCHLUESSEL.token, token);
          return (tokenRef.current = token);
        } catch {
          // Beim nächsten Aufruf nochmal versuchen (sonst liefe die ganze Sitzung ohne Kennung und alles ginge verloren)
          tokenPromise.current = null;
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
      setOhne(new Set(JSON.parse(localStorage.getItem(SCHLUESSEL.ohneErinnerung) ?? "[]")));
    } catch {
      /* egal */
    }
    setBereit(true);
    // Push-Abo des Handys beim Server auffrischen (falls die Anmeldung früher einmal fehlgeschlagen ist)
    pushAboErneuern(api).catch(() => {});
    api("/api/favoriten")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { ids: string[]; ohneErinnerung?: string[] } | null) => {
        if (d) {
          setFav(new Set(d.ids));
          setOhne(new Set(d.ohneErinnerung ?? []));
          schreib(SCHLUESSEL.ohneErinnerung, d.ohneErinnerung ?? []);
          schreib(SCHLUESSEL.fav, d.ids);
        }
      })
      .catch(() => {});
  }, [api]);

  useEffect(() => {
    einstRef.current = einstellungen;
  }, [einstellungen]);

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

  const setzeErinnerung = useCallback(
    (eventId: string, an: boolean) => {
      setOhne((alt) => {
        const neu = new Set(alt);
        if (an) neu.delete(eventId);
        else neu.add(eventId);
        schreib(SCHLUESSEL.ohneErinnerung, [...neu]);
        return neu;
      });
      api("/api/favoriten", { method: "PATCH", body: JSON.stringify({ eventId, erinnern: an }) }).catch(() => {});
    },
    [api]
  );

  const merken = useCallback(
    (eventId: string) => {
      const warSchon = favoritenRef.current.has(eventId);
      const e = einstRef.current;
      // Fragen, wenn Erinnerungen grundsätzlich an sind und „jedes Mal fragen“ eingestellt ist
      const fragen = !warSchon && e.erinnern && e.erinnerungFragen;
      // Beim Fragen erst einmal „nur merken“ – erinnert wird erst nach einem „Ja“
      const erinnern = !warSchon && e.erinnern && !fragen && !e.neueOhneErinnerung;
      if (warSchon) {
        zeigeHinweis("Nicht mehr gemerkt");
      } else if (fragen) {
        setFrageFuer(eventId);
      } else if (erinnern && pushMoeglich() && Notification.permission === "granted") {
        zeigeHinweis("Gemerkt ♥ Erinnerung kommt am Vortag um ca. 18 Uhr und am Tag um ca. 8 Uhr.");
      } else {
        zeigeHinweis("Gemerkt ♥ Du findest es unter „Meine“.");
      }
      setOhne((alt) => {
        if (warSchon || erinnern) {
          if (!alt.has(eventId)) return alt;
          const neu = new Set(alt);
          neu.delete(eventId);
          schreib(SCHLUESSEL.ohneErinnerung, [...neu]);
          return neu;
        }
        const neu = new Set(alt).add(eventId);
        schreib(SCHLUESSEL.ohneErinnerung, [...neu]);
        return neu;
      });
      setFav((alt) => {
        const neu = new Set(alt);
        if (warSchon) neu.delete(eventId);
        else neu.add(eventId);
        schreib(SCHLUESSEL.fav, [...neu]);
        return neu;
      });
      const anfrage = warSchon
        ? api(`/api/favoriten?eventId=${eventId}`, { method: "DELETE" })
        : api("/api/favoriten", { method: "POST", body: JSON.stringify({ eventId, erinnern }) });
      anfrage.catch(() => {});
    },
    [api, zeigeHinweis]
  );

  const schliesseFrage = useCallback(() => setFrageFuer(null), []);

  const wert = useMemo(
    () => ({ bereit, einstellungen, setzeEinstellungen, startpunkt, setzeStartpunkt, favoriten, merken, api, ohneErinnerung, setzeErinnerung, frageFuer, schliesseFrage, hinweis, zeigeHinweis }),
    [bereit, einstellungen, setzeEinstellungen, startpunkt, setzeStartpunkt, favoriten, merken, api, ohneErinnerung, setzeErinnerung, frageFuer, schliesseFrage, hinweis, zeigeHinweis]
  );
  return <Ctx.Provider value={wert}>{children}</Ctx.Provider>;
}

export function useApp(): AppZustand {
  const c = useContext(Ctx);
  if (!c) throw new Error("useApp außerhalb von AppZustandProvider");
  return c;
}
