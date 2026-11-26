"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, Check, Send } from "lucide-react";
import { useApp } from "@/lib/client/app-zustand";
import { pushAusschalten, pushEinschalten, pushStatus, type PushStatus } from "@/lib/client/push";

function Schalter({ an, onClick, titel, text }: { an: boolean; onClick: () => void; titel: string; text: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={an}
      onClick={onClick}
      className="flex min-h-14 w-full items-center gap-4 rounded-2xl bg-flaeche-2 px-4 py-3 text-left hover:bg-see-zart"
    >
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{titel}</span>
        <span className="block text-[0.9rem] text-gedaempft">{text}</span>
      </span>
      <span className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${an ? "bg-see" : "bg-linie"}`}>
        <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${an ? "left-7" : "left-1"}`} />
      </span>
    </button>
  );
}

export function Benachrichtigungen() {
  const { einstellungen: e, setzeEinstellungen, api, bereit } = useApp();
  const [status, setStatus] = useState<PushStatus>("unbekannt");
  const [laeuft, setLaeuft] = useState(false);
  const [testMeldung, setTestMeldung] = useState<string | null>(null);

  const testen = async () => {
    setTestMeldung("Wird geschickt …");
    const r = await api("/api/push/test", { method: "POST" }).catch(() => null);
    const d = (await r?.json().catch(() => null)) as { ok?: boolean; fehler?: string } | null;
    setTestMeldung(d?.ok ? "Geschickt – die Nachricht sollte gleich erscheinen." : (d?.fehler ?? "Hat nicht geklappt."));
  };

  useEffect(() => {
    pushStatus().then(setStatus).catch(() => setStatus("nicht-moeglich"));
  }, []);

  const umschalten = async () => {
    setLaeuft(true);
    try {
      setStatus(status === "an" ? await pushAusschalten(api) : await pushEinschalten(api));
    } finally {
      setLaeuft(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {status === "nicht-moeglich" ? (
        <p className="rounded-2xl bg-flaeche-2 p-4 text-gedaempft">
          Auf diesem Gerät gehen keine Benachrichtigungen. Am Android-Handy klappt es, wenn die App installiert ist („Zum Startbildschirm hinzufügen“).
        </p>
      ) : (
        <button
          type="button"
          onClick={umschalten}
          disabled={laeuft || !bereit || status === "unbekannt"}
          className={`flex min-h-16 items-center justify-center gap-3 rounded-2xl px-5 text-lg font-bold transition-colors disabled:opacity-60 ${
            status === "an" ? "bg-see-zart text-see ring-2 ring-see" : "bg-see text-white shadow-karte"
          }`}
        >
          {status === "an" ? <Check className="h-6 w-6" /> : <Bell className="h-6 w-6" />}
          {laeuft ? "Einen Moment …" : status === "an" ? "Benachrichtigungen sind an" : "Benachrichtigungen einschalten"}
        </button>
      )}
      {status === "an" && (
        <div className="flex flex-col items-center gap-1">
          <button type="button" onClick={testen} className="flex min-h-12 items-center gap-2 rounded-full bg-flaeche-2 px-5 font-semibold ring-1 ring-linie">
            <Send className="h-5 w-5 text-see" /> Test-Nachricht schicken
          </button>
          {testMeldung && <p className="text-center text-[0.9rem] text-gedaempft" role="status">{testMeldung}</p>}
          <button type="button" onClick={umschalten} className="flex min-h-11 items-center justify-center gap-2 text-[0.95rem] font-semibold text-gedaempft">
            <BellOff className="h-4 w-4" /> Alle ausschalten
          </button>
        </div>
      )}
      {status === "blockiert" && (
        <p className="rounded-2xl bg-abendsonne-zart p-4 font-semibold text-abendsonne">
          Benachrichtigungen sind am Handy gesperrt. Erlauben kannst du sie in den Handy-Einstellungen → Apps → „Wo is wos los?“ → Benachrichtigungen.
        </p>
      )}

      <div className={`flex flex-col gap-2 ${status === "an" ? "" : "opacity-60"}`}>
        <Schalter
          an={e.erinnern}
          onClick={() => setzeEinstellungen({ erinnern: !e.erinnern })}
          titel="Erinnerungen an gemerkte Veranstaltungen"
          text="Am Vortag um ca. 18 Uhr und am Tag um ca. 8 Uhr. Absagen und Terminänderungen meldet die App immer."
        />
        {e.erinnern && (
          <Schalter
            an={e.erinnerungFragen}
            onClick={() => setzeEinstellungen({ erinnerungFragen: !e.erinnerungFragen })}
            titel="Beim Merken jedes Mal fragen"
            text={
              e.erinnerungFragen
                ? "Nach dem Herz kommt die Frage: erinnern oder nur merken?"
                : "Aus: Jedes gemerkte Event wird automatisch erinnert."
            }
          />
        )}
        <Schalter
          an={e.wochenendTipp}
          onClick={() => setzeEinstellungen({ wochenendTipp: !e.wochenendTipp })}
          titel="Wochenend-Tipp"
          text="Jeden Donnerstagabend die besten Veranstaltungen fürs Wochenende."
        />
        <div className="rounded-2xl bg-flaeche-2 px-4 py-3">
          <p className="font-semibold">„Neu für dich“</p>
          <p className="text-[0.9rem] text-gedaempft">Wenn neue Veranstaltungen zu deinen Interessen in deinem Umkreis auftauchen.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {(
              [
                ["taeglich", "Höchstens 1× am Tag"],
                ["seltener", "Seltener (2× pro Woche)"],
                ["aus", "Aus"],
              ] as const
            ).map(([id, text]) => (
              <button
                key={id}
                type="button"
                aria-pressed={e.neuFuerDich === id}
                onClick={() => setzeEinstellungen({ neuFuerDich: id })}
                className={`flex min-h-12 items-center gap-2 rounded-full px-4 text-[0.95rem] font-semibold ${
                  e.neuFuerDich === id ? "bg-see text-white shadow" : "bg-flaeche text-foreground ring-1 ring-linie"
                }`}
              >
                {e.neuFuerDich === id && <Check className="h-4 w-4" />}
                {text}
              </button>
            ))}
          </div>
        </div>
        <p className="px-1 text-[0.85rem] text-gedaempft">Zwischen 21 und 8 Uhr kommen keine Nachrichten.</p>
      </div>
    </div>
  );
}
