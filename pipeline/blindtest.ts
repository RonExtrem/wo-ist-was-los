// Blindtest: Wie viele Events der Testliste findet die App? Aufruf: node --env-file=.env.local pipeline/blindtest.ts
import { readFile } from "node:fs/promises";
import { db, dbSchliessen } from "./lib/db.ts";

interface TestEvent {
  titel: string;
  suchbegriffe: string[];
  ort: string;
  von: string;
  bis: string;
  thema: string;
  land: string;
}

const liste = JSON.parse(await readFile(new URL("./testliste.json", import.meta.url), "utf8")) as { events: TestEvent[] };
let gefunden = 0;
for (const t of liste.events) {
  const muster = t.suchbegriffe.map((s) => `%${s}%`);
  const { rows } = await db().query(
    `SELECT titel, beginn, ort_name FROM events
      WHERE titel ILIKE ANY($1::text[])
        AND coalesce(ende, beginn) >= $2::date - interval '1 day'
        AND beginn <= $3::date + interval '2 days'
      LIMIT 1`,
    [muster, t.von, t.bis]
  );
  const ok = rows.length > 0;
  if (ok) gefunden++;
  console.log(`${ok ? "✅" : "❌"} ${t.titel} (${t.von}, ${t.ort}, ${t.land})${ok ? `  → „${rows[0].titel}“` : ""}`);
}
console.log(`\nGefunden: ${gefunden} von ${liste.events.length}`);
await dbSchliessen();
