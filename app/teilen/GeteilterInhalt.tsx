"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Heart, LoaderCircle, Sparkles, TriangleAlert } from "lucide-react";
import { useApp } from "@/lib/client/app-zustand";
import { KATEGORIEN } from "@/lib/kategorien";
import { KATEGORIE_ICON } from "@/components/KategorieBild";

interface Formular {
  titel: string;
  datum: string;
  uhrzeit: string;
  datumEnde: string;
  ort: string;
  adresse: string;
  kategorie: string;
  kurzbeschreibung: string;
  preisText: string;
  gratis: boolean | null;
  freiluft: boolean | null;
  bildUrl: string;
}

const LEER: Formular = {
  titel: "",
  datum: "",
  uhrzeit: "",
  datumEnde: "",
  ort: "",
  adresse: "",
  kategorie: "sonstiges",
  kurzbeschreibung: "",
  preisText: "",
  gratis: null,
  freiluft: null,
  bildUrl: "",
};

function Feld({ label, children, hinweis }: { label: string; children: React.ReactNode; hinweis?: string }) {
  return (
    <label className="block">
      <span className="text-[0.95rem] font-semibold">{label}</span>
      {children}
      {hinweis && <span className="mt-1 block text-[0.85rem] text-gedaempft">{hinweis}</span>}
    </label>
  );
}

const eingabeKlasse =
  "mt-1 h-14 w-full rounded-2xl bg-flaeche px-4 text-lg ring-1 ring-linie outline-none focus:ring-2 focus:ring-see";

export function GeteilterInhalt() {
  const params = useSearchParams();
  const router = useRouter();
  const { api, bereit, favoriten, merken } = useApp();
  const titel = params.get("title") ?? "";
  const text = params.get("text") ?? "";
  const url = params.get("url") ?? "";
  const hatInhalt = !!(titel || text || url);

  const [phase, setPhase] = useState<"ki" | "formular" | "speichert">(hatInhalt ? "ki" : "formular");
  const [f, setF] = useState<Formular>({ ...LEER, titel });
  const [link, setLink] = useState(url);
  const [hinweis, setHinweis] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const gestartet = useRef(false);

  useEffect(() => {
    if (!bereit || !hatInhalt || gestartet.current) return;
    gestartet.current = true;
    api("/api/teilen/vorschlag", { method: "POST", body: JSON.stringify({ titel, text, url }) })
      .then((r) => r.json())
      .then((d: { vorschlag?: Formular & { gefunden: boolean }; url?: string; fehler?: string }) => {
        if (d.url) setLink(d.url);
        if (d.vorschlag) {
          const { gefunden, ...rest } = d.vorschlag;
          setF(rest);
          setHinweis(
            gefunden
              ? "Die KI hat das herausgelesen – bitte kurz prüfen, besonders das Datum."
              : "Ich konnte nicht alles herauslesen. Bitte die fehlenden Angaben ergänzen."
          );
        } else {
          setHinweis(d.fehler ?? "Bitte selbst ausfüllen.");
        }
      })
      .catch(() => setHinweis("Das Auslesen hat nicht geklappt – bitte selbst ausfüllen."))
      .finally(() => setPhase("formular"));
  }, [bereit, hatInhalt, api, titel, text, url]);

  const setze = (teil: Partial<Formular>) => setF((alt) => ({ ...alt, ...teil }));

  const speichern = async () => {
    setFehler(null);
    setPhase("speichert");
    const r = await api("/api/teilen", { method: "POST", body: JSON.stringify({ ...f, url: link }) }).catch(() => null);
    const d = (await r?.json().catch(() => null)) as { id?: string; fehler?: string } | null;
    if (d?.id) {
      if (!favoriten.has(d.id)) merken(d.id); // gleich gemerkt (und ggf. Frage nach Erinnerungen)
      router.replace(`/event/${d.id}`);
      return;
    }
    setFehler(d?.fehler ?? "Speichern hat nicht geklappt. Bitte nochmal probieren.");
    setPhase("formular");
  };

  if (phase === "ki") {
    return (
      <div className="mt-10 flex flex-col items-center gap-4 rounded-3xl bg-flaeche-2 px-6 py-12 text-center">
        <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-see-zart text-see">
          <Sparkles className="h-8 w-8" />
          <LoaderCircle className="absolute -inset-1 h-[4.5rem] w-[4.5rem] animate-spin text-see/50" strokeWidth={1.5} />
        </span>
        <p className="font-titel text-xl">Ich lese die Veranstaltung heraus …</p>
        <p className="text-gedaempft">Das dauert ein paar Sekunden.</p>
      </div>
    );
  }

  return (
    <form
      className="mt-5 flex flex-col gap-5"
      onSubmit={(ev) => {
        ev.preventDefault();
        speichern();
      }}
    >
      {hinweis && (
        <p className="flex gap-3 rounded-2xl bg-see-zart p-4 font-semibold text-see">
          <Sparkles aria-hidden className="mt-0.5 h-5 w-5 shrink-0" /> {hinweis}
        </p>
      )}

      <Feld label="Name der Veranstaltung">
        <input value={f.titel} onChange={(e) => setze({ titel: e.target.value })} required minLength={3} className={eingabeKlasse} />
      </Feld>

      <div className="grid grid-cols-[3fr_2fr] gap-3">
        <Feld label="Datum">
          <input type="date" value={f.datum} onChange={(e) => setze({ datum: e.target.value })} required className={`${eingabeKlasse} px-3`} />
        </Feld>
        <Feld label="Uhrzeit" hinweis="leer = ganztägig">
          <input type="time" value={f.uhrzeit} onChange={(e) => setze({ uhrzeit: e.target.value })} className={`${eingabeKlasse} px-3`} />
        </Feld>
      </div>
      <Feld label="Bis (bei mehrtägigen)" hinweis="leer lassen, wenn nur ein Tag">
        <input type="date" value={f.datumEnde} min={f.datum} onChange={(e) => setze({ datumEnde: e.target.value })} className={eingabeKlasse} />
      </Feld>

      <Feld label="Ort" hinweis="Gemeinde oder Stadt, z. B. Spittal an der Drau">
        <input value={f.ort} onChange={(e) => setze({ ort: e.target.value })} required className={eingabeKlasse} />
      </Feld>
      <Feld label="Wo genau? (freiwillig)" hinweis="z. B. Gasthaus, Platz oder Straße">
        <input value={f.adresse} onChange={(e) => setze({ adresse: e.target.value })} className={eingabeKlasse} />
      </Feld>

      <div>
        <p className="text-[0.95rem] font-semibold">Thema</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {KATEGORIEN.map((k) => {
            const Icon = KATEGORIE_ICON[k.id];
            const an = f.kategorie === k.id;
            return (
              <button
                key={k.id}
                type="button"
                aria-pressed={an}
                onClick={() => setze({ kategorie: k.id })}
                className={`flex min-h-12 items-center gap-2 rounded-full px-4 text-[0.95rem] font-semibold ${
                  an ? "bg-see text-white shadow" : "bg-flaeche ring-1 ring-linie"
                }`}
              >
                <Icon className="h-5 w-5" style={{ color: an ? "white" : k.farbe }} /> {k.name}
              </button>
            );
          })}
        </div>
      </div>

      <Feld label="Kurze Beschreibung (freiwillig)">
        <textarea
          value={f.kurzbeschreibung}
          onChange={(e) => setze({ kurzbeschreibung: e.target.value })}
          rows={3}
          className="mt-1 w-full rounded-2xl bg-flaeche p-4 text-lg ring-1 ring-linie outline-none focus:ring-2 focus:ring-see"
        />
      </Feld>

      {link && <p className="break-all text-[0.9rem] text-gedaempft">Link: {link}</p>}

      {fehler && (
        <p className="flex gap-3 rounded-2xl bg-abendsonne-zart p-4 font-semibold text-abendsonne" role="alert">
          <TriangleAlert aria-hidden className="mt-0.5 h-5 w-5 shrink-0" /> {fehler}
        </p>
      )}

      <button
        type="submit"
        disabled={phase === "speichert"}
        className="flex min-h-16 items-center justify-center gap-3 rounded-2xl bg-see text-lg font-bold text-white shadow-karte disabled:opacity-60"
      >
        {phase === "speichert" ? <LoaderCircle className="h-6 w-6 animate-spin" /> : <Heart className="h-6 w-6" />}
        {phase === "speichert" ? "Wird gespeichert …" : "Speichern & merken"}
      </button>
      <p className="-mt-2 mb-6 text-center text-[0.85rem] text-gedaempft">Die Veranstaltung erscheint danach auch in der Suche und auf der Karte.</p>
    </form>
  );
}
