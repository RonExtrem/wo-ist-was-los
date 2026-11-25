"use client";

import { useEffect } from "react";

/** Meldet den Service Worker an (Voraussetzung für Installation und Push). */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch((err) => console.error("Service Worker konnte nicht starten:", err));
  }, []);
  return null;
}
