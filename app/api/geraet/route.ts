import { neuesGeraet } from "@/lib/geraet-server";

// Unsichtbare Anmeldung: Beim ersten Öffnen bekommt das Handy einen geheimen Schlüssel.
export async function POST() {
  const token = await neuesGeraet();
  return Response.json({ token });
}
