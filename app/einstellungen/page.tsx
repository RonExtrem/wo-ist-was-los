"use client";

import { useState } from "react";
import { House, Check, Sun, Moon, SunMoon } from "lucide-react";
import { useApp } from "@/lib/client/app-zustand";
import { OrtSuche } from "@/components/StartpunktWahl";
import { AnsichtWahl } from "@/components/EventListe";
import { Benachrichtigungen } from "./Benachrichtigungen";
import { Uebertragung } from "./Uebertragung";
import Link from "next/link";
import { KATEGORIE_ICON } from "@/components/KategorieBild";
import { KATEGORIEN } from "@/lib/kategorien";
import { ZurueckKnopf } from "../event/[id]/DetailAktionen";

function Karte({ titel, text, children }: { titel: string; text?: string; children: React.ReactNode }) {
  return (
    <section className="mt-5 rounded-3xl bg-flaeche p-5 shadow-karte ring-1 ring-linie">
      <h2 className="font-titel text-xl">{titel}</h2>
      {text && <p className="mt-1 text-[0.95rem] text-gedaempft">{text}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Auswahl({ an, onClick, children }: { an: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={an}
      className={`flex min-h-12 items-center gap-2 rounded-full px-4 text-[0.95rem] font-semibold transition-colors ${
        an ? "bg-see text-white shadow" : "bg-flaeche-2 text-foreground hover:bg-see-zart"
      }`}
    >
      {an && <Check className="h-4 w-4" />}
      {children}
    </button>
  );
}

export default function Einstellungen() {
  const { einstellungen: e, setzeEinstellungen } = useApp();
  const [ortWahl, setOrtWahl] = useState(false);

  const interesseUmschalten = (id: string) =>
    setzeEinstellungen({ interessen: e.interessen.includes(id) ? e.interessen.filter((x) => x !== id) : [...e.interessen, id] });

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-5 pt-[calc(env(safe-area-inset-top)+1rem)]">
      <div className="flex items-center gap-3">
        <ZurueckKnopf />
        <h1 className="font-titel text-[2.1rem] leading-tight">Einstellungen</h1>
      </div>

      <Karte titel="Daheim" text="Von hier aus werden Umkreis und Entfernung gemessen.">
        <button
          type="button"
          onClick={() => setOrtWahl(true)}
          className="flex min-h-14 w-full items-center gap-3 rounded-2xl bg-flaeche-2 px-4 text-left hover:bg-see-zart"
        >
          <House className="h-6 w-6 text-see" />
          <span className="flex-1 text-lg font-semibold">{e.wohnortName}</span>
          <span className="font-semibold text-see">Ändern</span>
        </button>
        <OrtSuche
          offen={ortWahl}
          titel="Wo bist du daheim?"
          schliessen={() => setOrtWahl(false)}
          gewaehlt={(o) => {
            setzeEinstellungen({ wohnortName: o.name, lat: o.lat, lng: o.lng });
            setOrtWahl(false);
          }}
        />
      </Karte>

      <Karte titel="Wie weit fährst du gern?" text="Standard-Umkreis für „in deiner Nähe“.">
        <div className="flex flex-wrap gap-2">
          {[10, 25, 50, 75, 100, 150].map((km) => (
            <Auswahl key={km} an={e.umkreisKm === km} onClick={() => setzeEinstellungen({ umkreisKm: km })}>
              {km} km
            </Auswahl>
          ))}
        </div>
      </Karte>

      <Karte titel="Was interessiert dich?" text="Diese Themen erscheinen unter „Für dich“.">
        <div className="flex flex-wrap gap-2">
          {KATEGORIEN.map((k) => {
            const Icon = KATEGORIE_ICON[k.id];
            const an = e.interessen.includes(k.id);
            return (
              <Auswahl key={k.id} an={an} onClick={() => interesseUmschalten(k.id)}>
                {!an && <Icon className="h-5 w-5" style={{ color: k.farbe }} />}
                {k.name}
              </Auswahl>
            );
          })}
        </div>
      </Karte>

      <Karte titel="Benachrichtigungen" text="Erinnerungen und Tipps direkt aufs Handy.">
        <Benachrichtigungen />
      </Karte>

      <Karte titel="Schriftgröße">
        <div className="flex flex-col gap-2">
          {(
            [
              ["normal", "Normal", "1rem"],
              ["gross", "Groß", "1.125rem"],
              ["sehr_gross", "Sehr groß", "1.25rem"],
            ] as const
          ).map(([id, text, groesse]) => (
            <button
              key={id}
              type="button"
              onClick={() => setzeEinstellungen({ schriftgroesse: id })}
              aria-pressed={e.schriftgroesse === id}
              className={`flex min-h-14 items-center justify-between rounded-2xl px-4 text-left ring-1 transition-colors ${
                e.schriftgroesse === id ? "bg-see-zart ring-see" : "bg-flaeche-2 ring-transparent hover:bg-see-zart"
              }`}
            >
              <span style={{ fontSize: groesse }} className="font-semibold">{text} – So sieht der Text aus</span>
              {e.schriftgroesse === id && <Check className="h-5 w-5 text-see" />}
            </button>
          ))}
        </div>
      </Karte>

      <Karte titel="Ansicht der Veranstaltungen" text="Groß mit Bild, Kacheln (zwei nebeneinander) oder eine kompakte Liste.">
        <AnsichtWahl />
      </Karte>

      <Karte titel="Hell oder dunkel?">
        <div className="flex flex-wrap gap-2">
          <Auswahl an={e.theme === "auto"} onClick={() => setzeEinstellungen({ theme: "auto" })}>
            <SunMoon className="h-5 w-5" /> Wie das Handy
          </Auswahl>
          <Auswahl an={e.theme === "hell"} onClick={() => setzeEinstellungen({ theme: "hell" })}>
            <Sun className="h-5 w-5" /> Hell
          </Auswahl>
          <Auswahl an={e.theme === "dunkel"} onClick={() => setzeEinstellungen({ theme: "dunkel" })}>
            <Moon className="h-5 w-5" /> Dunkel
          </Auswahl>
        </div>
      </Karte>

      <Karte titel="Neues Handy?" text="So nimmst du Gemerktes und Einstellungen mit.">
        <Uebertragung />
      </Karte>

      <p className="mb-6 mt-8 text-center text-[0.85rem] text-gedaempft">
        <Link href="/status" className="underline-offset-4 hover:underline">
          Quellen-Status
        </Link>
      </p>

      <p className="mt-8 pb-4 text-center text-[0.85rem] text-gedaempft">
        „Wo is wos los?“ · Veranstaltungen aus Kärnten, Slowenien und Friaul.
        <br />
        Alle Angaben ohne Gewähr – maßgeblich ist die Seite des Veranstalters.
      </p>
    </main>
  );
}
