"use client";

// Begrüßung beim ersten Start: Jedes Handy ist das Profil einer Person (Name, Daheim, Interessen).
import { useEffect, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Bell, Check, ChevronLeft, House, LoaderCircle, LocateFixed, MapPin, Search, Smartphone } from "lucide-react";
import { useApp } from "@/lib/client/app-zustand";
import { tourStarten } from "@/lib/client/tour";
import { pushEinschalten, pushStatus, type PushStatus } from "@/lib/client/push";
import { KATEGORIEN } from "@/lib/kategorien";
import { KATEGORIE_ICON } from "@/components/KategorieBild";
import { Uebertragung } from "@/app/einstellungen/Uebertragung";

interface Ort {
  name: string;
  lat: number;
  lng: number;
  zusatz?: string;
}

const keinAbo = () => () => {};

export function Willkommen() {
  const { bereit, einstellungen } = useApp();
  // Erst nach dem Übernehmen der Seite im Browser zeigen (sonst passt das Server-HTML nicht)
  const imBrowser = useSyncExternalStore(keinAbo, () => true, () => false);
  if (!imBrowser || !bereit || einstellungen.eingerichtet) return null;
  return <Assistent />;
}

const SCHRITTE = 4;

function Assistent() {
  const { einstellungen: e, setzeEinstellungen, setzeStartpunkt, api } = useApp();
  const [schritt, setSchritt] = useState(0);
  const [mitCode, setMitCode] = useState(false);
  const [name, setName] = useState(e.name);
  const [ort, setOrt] = useState<Ort>({ name: e.wohnortName, lat: e.lat, lng: e.lng });
  const [interessen, setInteressen] = useState<string[]>(e.interessen);
  const vorname = name.trim();

  const fertig = () => {
    // „9500 Villach“ → „Villach“ (Postleitzahl nur zum Finden)
    const ortName = ort.name.replace(/^\d{4,5}\s+/, "");
    setzeEinstellungen({ name: vorname, wohnortName: ortName, lat: ort.lat, lng: ort.lng, interessen, eingerichtet: true });
    setzeStartpunkt({ art: "daheim", name: ortName, lat: ort.lat, lng: ort.lng });
  };

  const knopf =
    "flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-see px-5 text-lg font-bold text-white shadow-karte transition-transform active:scale-[0.99] disabled:opacity-50";

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-background" role="dialog" aria-modal="true" aria-label="Willkommen">
      {/* sanfter Weißensee-Himmel oben */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-gradient-to-b from-see/25 to-transparent" />
      <div className="relative mx-auto flex min-h-full w-full max-w-xl flex-col px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-[calc(env(safe-area-inset-top)+1rem)]">
        {/* Kopf: zurück + Fortschritt */}
        <div className="flex h-12 items-center gap-3">
          {schritt > 0 && !mitCode ? (
            <button
              type="button"
              onClick={() => setSchritt((s) => s - 1)}
              aria-label="Zurück"
              className="flex h-12 w-12 items-center justify-center rounded-full bg-flaeche-2"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
          ) : mitCode ? (
            <button
              type="button"
              onClick={() => setMitCode(false)}
              aria-label="Zurück"
              className="flex h-12 w-12 items-center justify-center rounded-full bg-flaeche-2"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
          ) : null}
          {!mitCode && (
            <div className="ml-auto flex items-center gap-2" aria-label={`Schritt ${schritt + 1} von ${SCHRITTE}`}>
              {Array.from({ length: SCHRITTE }, (_, i) => (
                <span
                  key={i}
                  className={`h-2.5 rounded-full transition-all ${i === schritt ? "w-8 bg-see" : i < schritt ? "w-2.5 bg-see/60" : "w-2.5 bg-linie"}`}
                />
              ))}
            </div>
          )}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={mitCode ? "code" : schritt}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="flex flex-1 flex-col"
          >
            {mitCode ? (
              <>
                <h1 className="mt-6 font-titel text-[2.2rem] leading-tight">Vom alten Handy übernehmen</h1>
                <p className="mt-2 text-lg text-gedaempft">
                  Am alten Handy unter Einstellungen → „Neues Handy?“ den Code anzeigen lassen und hier eingeben. Name, Daheim, Interessen und
                  alles Gemerkte kommen mit.
                </p>
                <div className="mt-6">
                  <Uebertragung nurEingeben />
                </div>
              </>
            ) : schritt === 0 ? (
              <>
                <p className="mt-8 text-5xl" aria-hidden>
                  👋
                </p>
                <h1 className="mt-4 font-titel text-[2.4rem] leading-tight">Servus!</h1>
                <p className="mt-2 text-lg text-gedaempft">
                  Schön, dass du da bist. In drei kurzen Schritten richtet sich „Wo is wos los?“ für dich ein.
                </p>
                <label htmlFor="vorname" className="mt-8 block text-lg font-semibold">
                  Wie heißt du?
                </label>
                <input
                  id="vorname"
                  value={name}
                  onChange={(ev) => setName(ev.target.value)}
                  onKeyDown={(ev) => ev.key === "Enter" && setSchritt(1)}
                  placeholder="Vorname"
                  autoComplete="given-name"
                  autoCapitalize="words"
                  enterKeyHint="next"
                  maxLength={40}
                  className="mt-2 h-14 w-full rounded-2xl bg-flaeche px-4 text-xl shadow-karte ring-1 ring-linie outline-none focus:ring-2 focus:ring-see"
                />
                <div className="mt-auto pt-8">
                  <button type="button" className={knopf} onClick={() => setSchritt(1)}>
                    {vorname ? "Weiter" : "Ohne Namen weiter"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMitCode(true)}
                    className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl font-semibold text-see"
                  >
                    <Smartphone className="h-5 w-5" /> Ich hatte die App schon auf einem anderen Handy
                  </button>
                </div>
              </>
            ) : schritt === 1 ? (
              <>
                <h1 className="mt-6 font-titel text-[2.2rem] leading-tight">Wo bist du daheim{vorname ? `, ${vorname}` : ""}?</h1>
                <p className="mt-2 text-lg text-gedaempft">Von hier aus misst die App Entfernungen und den Umkreis.</p>
                <div className="mt-6 flex min-h-16 items-center gap-3 rounded-2xl bg-see-zart px-4 py-3">
                  <House className="h-6 w-6 shrink-0 text-see" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[0.85rem] font-semibold text-see">Daheim</span>
                    <span className="block truncate text-xl font-semibold">{ort.name}</span>
                  </span>
                  <Check className="h-6 w-6 shrink-0 text-see" />
                </div>
                <OrtWahl gewaehlt={setOrt} />
                <div className="mt-auto pt-8">
                  <button type="button" className={knopf} onClick={() => setSchritt(2)}>
                    Weiter
                  </button>
                </div>
              </>
            ) : schritt === 2 ? (
              <>
                <h1 className="mt-6 font-titel text-[2.2rem] leading-tight">Was interessiert dich?</h1>
                <p className="mt-2 text-lg text-gedaempft">Tipp alles an, was dir gefällt. Das kommt dann unter „Für dich“. Du kannst es jederzeit ändern.</p>
                <ul className="mt-5 grid grid-cols-1 gap-2 min-[480px]:grid-cols-2">
                  {KATEGORIEN.map((k) => {
                    const Icon = KATEGORIE_ICON[k.id];
                    const an = interessen.includes(k.id);
                    return (
                      <li key={k.id}>
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={an}
                          onClick={() => setInteressen((alt) => (an ? alt.filter((x) => x !== k.id) : [...alt, k.id]))}
                          className={`flex min-h-14 w-full items-center gap-3 rounded-2xl px-3 text-left text-lg font-semibold ring-1 transition-colors ${
                            an ? "bg-see-zart ring-see" : "bg-flaeche ring-linie"
                          }`}
                        >
                          <span
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                            style={{ background: an ? k.farbe : `color-mix(in oklab, ${k.farbe} 15%, transparent)` }}
                          >
                            <Icon className="h-5 w-5" style={{ color: an ? "#fff" : k.farbe }} />
                          </span>
                          <span className="min-w-0 flex-1 leading-tight">{k.name}</span>
                          <span
                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 ${an ? "border-see bg-see text-white" : "border-linie"}`}
                          >
                            {an && <Check className="h-5 w-5" />}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <div className="sticky bottom-0 mt-auto bg-gradient-to-t from-background via-background to-transparent pb-1 pt-6">
                  <button type="button" className={knopf} onClick={() => setSchritt(3)}>
                    {interessen.length ? `Weiter (${interessen.length} gewählt)` : "Ohne Auswahl weiter"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="mt-8 text-5xl" aria-hidden>
                  🎉
                </p>
                <h1 className="mt-4 font-titel text-[2.2rem] leading-tight">Alles bereit{vorname ? `, ${vorname}` : ""}!</h1>
                <p className="mt-2 text-lg text-gedaempft">
                  Mit dem Herz ♥ merkst du dir Veranstaltungen. Auf Wunsch erinnert dich die App am Vortag und am Tag selbst.
                </p>
                <PushKnopf api={api} />
                <div className="mt-6 rounded-2xl bg-see-zart p-4">
                  <p className="text-lg font-bold text-see">Unser Tipp: die kurze Tour</p>
                  <p className="mt-1 text-[1rem]">
                    In etwa 2 Minuten zeigt dir die App Schritt für Schritt alles, was sie kann – ein paar Mal tippst du selbst. Du findest die
                    Tour später auch in den Einstellungen.
                  </p>
                </div>
                <div className="mt-auto pt-8">
                  <button
                    type="button"
                    className={knopf}
                    onClick={() => {
                      fertig();
                      tourStarten();
                    }}
                  >
                    Tour starten (empfohlen)
                  </button>
                  <button type="button" onClick={fertig} className="mt-3 flex min-h-12 w-full items-center justify-center rounded-2xl font-semibold text-gedaempft">
                    Ohne Tour loslegen
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

/** Ort per Standort oder Suche (Ort oder Postleitzahl) wählen. */
function OrtWahl({ gewaehlt }: { gewaehlt: (o: Ort) => void }) {
  const { einstellungen } = useApp();
  const [text, setText] = useState("");
  const [treffer, setTreffer] = useState<Ort[]>([]);
  const [laedt, setLaedt] = useState(false);
  const [ortet, setOrtet] = useState(false);
  const [hinweis, setHinweis] = useState<string | null>(null);
  const genug = text.trim().length >= 2;

  useEffect(() => {
    if (!genug) return;
    const abbruch = new AbortController();
    const t = setTimeout(() => {
      setLaedt(true);
      fetch(`/api/ort?q=${encodeURIComponent(text.trim())}&lat=${einstellungen.lat.toFixed(3)}&lng=${einstellungen.lng.toFixed(3)}`, {
        signal: abbruch.signal,
      })
        .then((r) => r.json())
        .then((d: { orte: Ort[] }) => setTreffer(d.orte ?? []))
        .catch(() => !abbruch.signal.aborted && setTreffer([]))
        .finally(() => !abbruch.signal.aborted && setLaedt(false));
    }, 450);
    return () => {
      clearTimeout(t);
      abbruch.abort();
    };
  }, [text, genug, einstellungen.lat, einstellungen.lng]);

  const hier = () => {
    setHinweis(null);
    if (!("geolocation" in navigator)) {
      setHinweis("Dieses Handy kann den Standort nicht bestimmen. Bitte den Ort eintippen.");
      return;
    }
    setOrtet(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        const d = (await fetch(`/api/ort?rueck=1&lat=${lat.toFixed(4)}&lng=${lng.toFixed(4)}`)
          .then((r) => r.json())
          .catch(() => null)) as { name?: string | null } | null;
        setOrtet(false);
        gewaehlt({ name: d?.name || "Mein Standort", lat, lng });
      },
      () => {
        setOrtet(false);
        setHinweis("Standort nicht verfügbar. Bitte den Ort oder die Postleitzahl eintippen.");
      },
      { enableHighAccuracy: false, timeout: 12_000, maximumAge: 300_000 }
    );
  };

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={hier}
        className="flex min-h-14 w-full items-center gap-3 rounded-2xl bg-flaeche px-4 text-left text-lg font-semibold shadow-karte ring-1 ring-linie"
      >
        {ortet ? <LoaderCircle className="h-6 w-6 animate-spin text-see" /> : <LocateFixed className="h-6 w-6 text-see" />}
        Ich bin gerade daheim – Standort nehmen
      </button>
      {hinweis && <p className="mt-2 rounded-2xl bg-abendsonne-zart px-3 py-2 text-abendsonne">{hinweis}</p>}
      <label className="mt-3 flex min-h-14 items-center gap-3 rounded-2xl bg-flaeche px-4 shadow-karte ring-1 ring-linie focus-within:ring-2 focus-within:ring-see">
        <Search className="h-6 w-6 text-gedaempft" />
        <input
          value={text}
          onChange={(ev) => setText(ev.target.value)}
          placeholder="Oder Ort / Postleitzahl eintippen"
          aria-label="Ort oder Postleitzahl"
          enterKeyHint="search"
          className="h-14 min-w-0 flex-1 bg-transparent text-lg outline-none placeholder:text-gedaempft"
        />
        {laedt && <LoaderCircle className="h-5 w-5 animate-spin text-gedaempft" />}
      </label>
      {genug && (
        <ul className="mt-2">
          {treffer.map((o, i) => (
            <li key={`${o.name}-${i}`}>
              <button
                type="button"
                onClick={() => {
                  gewaehlt(o);
                  setText("");
                  setTreffer([]);
                }}
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
          {!laedt && treffer.length === 0 && <li className="px-3 py-3 text-gedaempft">Kein Ort gefunden. Probier die Postleitzahl.</li>}
        </ul>
      )}
    </div>
  );
}

/** Erinnerungen aufs Handy erlauben – nur zeigen, wenn es geht und noch aus ist. */
function PushKnopf({ api }: { api: (pfad: string, init?: RequestInit) => Promise<Response> }) {
  const [status, setStatus] = useState<PushStatus>("unbekannt");
  const [laeuft, setLaeuft] = useState(false);
  useEffect(() => {
    pushStatus().then(setStatus).catch(() => setStatus("nicht-moeglich"));
  }, []);
  if (status === "an")
    return (
      <p className="mt-6 flex items-center gap-2 rounded-2xl bg-see-zart px-4 py-3 font-semibold text-see">
        <Check className="h-5 w-5" /> Erinnerungen sind eingeschaltet.
      </p>
    );
  if (status !== "aus") return null;
  return (
    <button
      type="button"
      disabled={laeuft}
      onClick={async () => {
        setLaeuft(true);
        try {
          setStatus(await pushEinschalten(api));
        } finally {
          setLaeuft(false);
        }
      }}
      className="mt-6 flex min-h-14 w-full items-center gap-3 rounded-2xl bg-flaeche px-4 text-left text-lg font-semibold shadow-karte ring-1 ring-linie"
    >
      {laeuft ? <LoaderCircle className="h-6 w-6 animate-spin text-see" /> : <Bell className="h-6 w-6 text-see" />}
      Erinnerungen aufs Handy erlauben
    </button>
  );
}
