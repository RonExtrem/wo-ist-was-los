"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { House, LocateFixed, MapPin, Search, X, LoaderCircle } from "lucide-react";
import { useApp } from "@/lib/client/app-zustand";

interface OrtTreffer {
  name: string;
  lat: number;
  lng: number;
  zusatz?: string;
}

/** „📍 Daheim | Wo ich gerade bin | Anderer Ort…“ – von wo aus Umkreis und Entfernung gemessen werden. */
export function StartpunktWahl({ hell = false }: { hell?: boolean }) {
  const { startpunkt, setzeStartpunkt, einstellungen } = useApp();
  const [suchFenster, setSuchFenster] = useState(false);
  const [hinweis, setHinweis] = useState<string | null>(null);
  const [ortet, setOrtet] = useState(false);

  const daheim = () => setzeStartpunkt({ art: "daheim", name: einstellungen.wohnortName, lat: einstellungen.lat, lng: einstellungen.lng });

  const hier = () => {
    setHinweis(null);
    if (!("geolocation" in navigator)) {
      setHinweis("Dieses Handy kann den Standort nicht bestimmen.");
      return;
    }
    setOrtet(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setOrtet(false);
        setzeStartpunkt({ art: "hier", name: "Mein Standort", lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {
        setOrtet(false);
        setHinweis("Standort nicht verfügbar. Bitte in den Handy-Einstellungen den Standort für diese App erlauben.");
      },
      { enableHighAccuracy: false, timeout: 12_000, maximumAge: 300_000 }
    );
  };

  const knopf = (aktiv: boolean) =>
    `flex min-h-12 max-w-full items-center gap-2 rounded-full px-4 text-[0.95rem] font-semibold transition-colors ${
      aktiv
        ? hell
          ? "bg-white text-[#08525a] shadow"
          : "bg-see text-white shadow"
        : hell
          ? "bg-white/20 text-white backdrop-blur-sm hover:bg-white/30"
          : "bg-flaeche-2 text-foreground hover:bg-see-zart"
    }`;

  return (
    <div data-tour="startpunkt">
      <p className={`mb-2 text-[0.9rem] font-semibold ${hell ? "text-white/90" : "text-gedaempft"}`}>Entfernung messen ab:</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={daheim} className={knopf(startpunkt.art === "daheim")} aria-pressed={startpunkt.art === "daheim"}>
          <House className="h-5 w-5" /> Daheim · {einstellungen.wohnortName.replace(" an der Drau", "")}
        </button>
        <button type="button" onClick={hier} className={knopf(startpunkt.art === "hier")} aria-pressed={startpunkt.art === "hier"}>
          {ortet ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <LocateFixed className="h-5 w-5" />} Wo ich gerade bin
        </button>
        <button type="button" onClick={() => setSuchFenster(true)} className={knopf(startpunkt.art === "anders")} aria-pressed={startpunkt.art === "anders"}>
          <MapPin className="h-5 w-5" /> {startpunkt.art === "anders" ? startpunkt.name : "Anderer Ort …"}
        </button>
      </div>
      {hinweis && (
        <p role="status" className={`mt-2 rounded-2xl px-3 py-2 text-[0.9rem] ${hell ? "bg-black/30 text-white" : "bg-abendsonne-zart text-abendsonne"}`}>
          {hinweis}
        </p>
      )}
      <OrtSuche
        offen={suchFenster}
        schliessen={() => setSuchFenster(false)}
        gewaehlt={(o) => {
          setzeStartpunkt({ art: "anders", name: o.name, lat: o.lat, lng: o.lng });
          setSuchFenster(false);
        }}
      />
    </div>
  );
}

/** Fenster von unten zum Suchen eines Orts (eigener Dialog, keine Browser-Popups). */
export function OrtSuche({
  offen,
  schliessen,
  gewaehlt,
  titel = "Anderen Ort wählen",
  oben,
  autoFokus = true,
}: {
  offen: boolean;
  schliessen: () => void;
  gewaehlt: (o: OrtTreffer) => void;
  titel?: string;
  /** Zusätzliche Knöpfe über dem Suchfeld (z. B. „Auf der Karte antippen“) */
  oben?: React.ReactNode;
  /** Tastatur sofort öffnen (bei zusätzlichen Knöpfen lieber nicht) */
  autoFokus?: boolean;
}) {
  const [text, setText] = useState("");
  const [treffer, setTreffer] = useState<OrtTreffer[]>([]);
  const [laedt, setLaedt] = useState(false);
  const eingabe = useRef<HTMLInputElement>(null);
  // Orte in der Nähe des Wohnorts zuerst vorschlagen
  const { einstellungen } = useApp();
  const naehe = { lat: einstellungen.lat, lng: einstellungen.lng };

  useEffect(() => {
    if (offen && autoFokus) setTimeout(() => eingabe.current?.focus(), 250);
  }, [offen, autoFokus]);

  const zu = () => {
    setText("");
    setTreffer([]);
    schliessen();
  };
  const genug = text.trim().length >= 2;
  const sichtbar = genug ? treffer : [];

  useEffect(() => {
    if (!genug) return;
    // Ältere, langsamere Antworten (z. B. für „95“ statt „9500“) dürfen die neuen Treffer nicht überschreiben
    const abbruch = new AbortController();
    const t = setTimeout(() => {
      setLaedt(true);
      fetch(`/api/ort?q=${encodeURIComponent(text.trim())}&lat=${naehe.lat.toFixed(3)}&lng=${naehe.lng.toFixed(3)}`, {
        signal: abbruch.signal,
      })
        .then((r) => r.json())
        .then((d: { orte: OrtTreffer[] }) => setTreffer(d.orte ?? []))
        .catch(() => {
          if (!abbruch.signal.aborted) setTreffer([]);
        })
        .finally(() => {
          if (!abbruch.signal.aborted) setLaedt(false);
        });
    }, 450);
    return () => {
      clearTimeout(t);
      abbruch.abort();
    };
  }, [text, genug, naehe.lat, naehe.lng]);

  return (
    <AnimatePresence>
      {offen && (
        <motion.div className="fixed inset-0 z-50 flex items-end justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <button type="button" aria-label="Schließen" className="absolute inset-0 bg-black/45" onClick={zu} />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={titel}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 36 }}
            className="relative w-full max-w-xl rounded-t-[2rem] bg-flaeche p-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] text-foreground shadow-2xl"
          >
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-linie" />
            <div className="flex items-center justify-between">
              <h2 className="font-titel text-2xl">{titel}</h2>
              <button type="button" onClick={zu} aria-label="Schließen" className="flex h-12 w-12 items-center justify-center rounded-full bg-flaeche-2">
                <X className="h-6 w-6" />
              </button>
            </div>
            {oben}
            <label className="mt-4 flex min-h-14 items-center gap-3 rounded-2xl bg-flaeche-2 px-4 ring-1 ring-linie focus-within:ring-2 focus-within:ring-see">
              <Search className="h-6 w-6 text-gedaempft" />
              <input
                ref={eingabe}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Ort oder Postleitzahl, z. B. 9500"
                className="h-14 flex-1 bg-transparent text-lg outline-none placeholder:text-gedaempft"
                enterKeyHint="search"
              />
              {laedt && <LoaderCircle className="h-5 w-5 animate-spin text-gedaempft" />}
            </label>
            <ul className="mt-3 max-h-[45vh] overflow-y-auto">
              {sichtbar.map((o, i) => (
                <li key={`${o.name}-${i}`}>
                  <button
                    type="button"
                    onClick={() => { gewaehlt(o); setText(""); setTreffer([]); }}
                    className="flex min-h-14 w-full items-center gap-3 rounded-2xl px-3 text-left hover:bg-flaeche-2"
                  >
                    <MapPin className="h-5 w-5 shrink-0 text-see" />
                    <span>
                      <span className="block text-lg font-semibold">{o.name}</span>
                      {o.zusatz && <span className="block text-[0.9rem] text-gedaempft">{o.zusatz}</span>}
                    </span>
                  </button>
                </li>
              ))}
              {!laedt && genug && treffer.length === 0 && (
                <li className="px-3 py-4 text-gedaempft">Kein Ort gefunden. Probier die Postleitzahl oder den Nachbarort.</li>
              )}
            </ul>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
