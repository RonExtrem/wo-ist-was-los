import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible_Next, Young_Serif } from "next/font/google";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { AppZustandProvider } from "@/lib/client/app-zustand";
import { LeisteUnten } from "@/components/LeisteUnten";
import { NachObenKnopf } from "@/components/NachObenKnopf";
import { PushFrage } from "@/components/PushFrage";
import "./globals.css";

// Atkinson Hyperlegible: entwickelt für bessere Lesbarkeit bei Sehschwäche
const atkinson = Atkinson_Hyperlegible_Next({ variable: "--font-atkinson", subsets: ["latin", "latin-ext"] });
const youngSerif = Young_Serif({ variable: "--font-young-serif", subsets: ["latin", "latin-ext"], weight: "400" });

export const metadata: Metadata = {
  title: "Wo is wos los?",
  description: "Veranstaltungen, Messen und Feste in Kärnten, Slowenien und Friaul.",
  applicationName: "Wo is wos los?",
  appleWebApp: { capable: true, title: "Wo is wos los?", statusBarStyle: "default" },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0B6E78" },
    { media: "(prefers-color-scheme: dark)", color: "#0B1A1E" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
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
            <PushFrage />
          </Suspense>
        </AppZustandProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
