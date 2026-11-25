// Vorläufige Startseite (Etappe 1). Die echte Startseite kommt in Etappe 3.
export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      <header className="relative overflow-hidden bg-kopf px-5 pb-16 pt-12 text-white">
        <p className="text-base opacity-90">Servus!</p>
        <h1 className="mt-1 text-4xl font-bold tracking-tight">Wo is wos los?</h1>
        <p className="mt-3 max-w-md text-lg opacity-90">
          Messen, Konzerte und Feste in Kärnten, Slowenien und Friaul.
        </p>
        <svg
          aria-hidden
          viewBox="0 0 400 60"
          preserveAspectRatio="none"
          className="absolute inset-x-0 bottom-0 h-14 w-full text-background"
        >
          <path d="M0 60 L0 38 L60 14 L110 34 L170 6 L240 36 L290 22 L340 40 L400 26 L400 60 Z" fill="currentColor" />
        </svg>
      </header>
      <section className="mx-auto w-full max-w-xl flex-1 px-5 py-6">
        <div className="rounded-3xl bg-flaeche p-6 shadow-sm ring-1 ring-black/5">
          <h2 className="text-xl font-semibold">Das Grundgerüst steht</h2>
          <p className="mt-2 text-gedaempft">
            Hier erscheinen bald die Veranstaltungen in deiner Nähe.
          </p>
        </div>
      </section>
    </main>
  );
}
