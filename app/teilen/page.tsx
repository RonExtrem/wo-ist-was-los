import { Suspense } from "react";
import { GeteilterInhalt } from "./GeteilterInhalt";
import { ZurueckKnopf } from "../event/[id]/DetailAktionen";

// Ziel der Android-Teilen-Funktion (und „Selbst eintragen“): die KI macht daraus einen Vorschlag zum Prüfen.
export default function TeilenSeite() {
  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-5 pt-[calc(env(safe-area-inset-top)+1rem)]">
      <div className="flex items-center gap-3">
        <ZurueckKnopf />
        <h1 className="font-titel text-[2rem] leading-tight">Veranstaltung eintragen</h1>
      </div>
      <Suspense fallback={<p className="mt-4 text-gedaempft">Wird geladen …</p>}>
        <GeteilterInhalt />
      </Suspense>
    </main>
  );
}
