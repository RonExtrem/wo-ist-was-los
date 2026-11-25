import { createBrowserClient } from "@supabase/ssr";

/** Supabase im Browser. Ohne Umgebungsvariablen liefert die Funktion null (App läuft dann ohne Datenbank). */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  return createBrowserClient(url, key);
}
