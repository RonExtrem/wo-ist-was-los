import { Suspense } from "react";
import { GeteilterInhalt } from "./GeteilterInhalt";

// Ziel der Android-Teilen-Funktion. In Etappe 5 macht die KI daraus einen Event-Vorschlag.
export default function TeilenSeite() {
  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-5 py-8">
      <h1 className="text-3xl font-bold">Event übernehmen</h1>
      <Suspense fallback={<p className="mt-4 text-gedaempft">Wird geladen…</p>}>
        <GeteilterInhalt />
      </Suspense>
    </main>
  );
}
