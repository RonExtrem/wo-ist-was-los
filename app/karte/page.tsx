import Link from "next/link";
import { Map } from "lucide-react";

// Die Karte kommt in Etappe 4 (MapLibre + OpenFreeMap).
export default function Karte() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-5 pt-[calc(env(safe-area-inset-top)+1.25rem)]">
      <h1 className="font-titel text-[2.1rem] leading-tight">Karte</h1>
      <div className="mt-8 flex flex-col items-center rounded-3xl bg-flaeche-2 px-6 py-12 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-see-zart text-see">
          <Map className="h-8 w-8" />
        </span>
        <p className="font-titel mt-4 text-xl">Die Karte kommt bald</p>
        <p className="mt-2 text-gedaempft">Hier siehst du demnächst alle Veranstaltungen als Punkte auf der Landkarte – mit deinem Umkreis.</p>
        <Link href="/suchen" className="mt-5 flex min-h-12 items-center rounded-full bg-see px-6 font-semibold text-white">
          Bis dahin: Liste ansehen
        </Link>
      </div>
    </main>
  );
}
