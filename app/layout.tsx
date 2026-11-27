import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible_Next, Young_Serif } from "next/font/google";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { AppZustandProvider } from "@/lib/client/app-zustand";
import { LeisteUnten } from "@/components/LeisteUnten";
import { NachObenKnopf } from "@/components/NachObenKnopf";
import { ErinnerungsFrage } from "@/components/ErinnerungsFrage";
import { Willkommen } from "@/components/Willkommen";
import { Tour } from "@/components/Tour";
import { HinweisLeiste } from "@/components/HinweisLeiste";
import "./globals.css";

// Atkinson Hyperlegible: entwickelt für bessere Lesbarkeit bei Sehschwäche
const atkinson = Atkinson_Hyperlegible_Next({ variable: "--font-atkinson", subsets: ["latin", "latin-ext"] });
const youngSerif = Young_Serif({ variable: "--font-young-serif", subsets: ["latin", "latin-ext"], weight: "400" });

export const metadata: Metadata = {
  title: "Wo is wos los?",
  description: "Veranstaltungen, Messen und Feste in Österreich, Slowenien und Italien.",
  applicationName: "Wo is wos los?",
  appleWebApp: { capable: true, title: "Wo is wos los?", statusBarStyle: "default" },
  // icon ausdrücklich angeben: mit „icons“ hier wird app/icon.png nicht mehr automatisch eingebunden (sonst fehlt das Tab-Symbol)
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0B6E78" },
    { media: "(prefers-color-scheme: dark)", color: "#0B1A1E" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Android-Tastatur schiebt Fenster von unten (z. B. Ortssuche) nach oben, statt die Treffer zu verdecken
  interactiveWidget: "resizes-content",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="de-AT" data-schrift="gross" className={`${atkinson.variable} ${youngSerif.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        <AppZustandProvider>
          <div className="unten-platz flex flex-1 flex-col">{children}</div>
          <Suspense fallback={null}>
            <LeisteUnten />
            <NachObenKnopf />
            <ErinnerungsFrage />
            <HinweisLeiste />
            <Willkommen />
            <Tour />
          </Suspense>
        </AppZustandProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
