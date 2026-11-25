import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Wo ist was los?",
    short_name: "Wo ist was los?",
    description: "Veranstaltungen, Messen und Feste in Kärnten, Slowenien und Friaul.",
    lang: "de-AT",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F4F8F8",
    theme_color: "#0B6E78",
    categories: ["entertainment", "lifestyle", "travel"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // Android: "Teilen" → "Wo ist was los?" schickt Text/Link an /teilen
    share_target: {
      action: "/teilen",
      method: "GET",
      params: { title: "title", text: "text", url: "url" },
    },
  };
}
