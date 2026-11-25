import type { Metadata, Viewport } from "next";
import { Figtree } from "next/font/google";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import "./globals.css";

const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin", "latin-ext"],
});

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
    { media: "(prefers-color-scheme: dark)", color: "#0C1D22" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="de-AT" className={`${figtree.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
