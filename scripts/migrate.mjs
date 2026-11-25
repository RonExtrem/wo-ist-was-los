// Spielt alle SQL-Dateien aus db/migrations der Reihe nach ein (jede nur einmal).
// Aufruf: node --env-file=.env.local scripts/migrate.mjs
import { Pool } from "@neondatabase/serverless";
import { readdir, readFile } from "node:fs/promises";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL fehlt.");
  process.exit(1);
}

const pool = new Pool({ connectionString: url });
try {
  await pool.query(
    "CREATE TABLE IF NOT EXISTS _migrationen (name text PRIMARY KEY, eingespielt timestamptz NOT NULL DEFAULT now())"
  );
  const { rows } = await pool.query("SELECT name FROM _migrationen");
  const erledigt = new Set(rows.map((r) => r.name));
  const dateien = (await readdir("db/migrations")).filter((f) => f.endsWith(".sql")).sort();
  for (const datei of dateien) {
    if (erledigt.has(datei)) continue;
    const text = await readFile(`db/migrations/${datei}`, "utf8");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(text);
      await client.query("INSERT INTO _migrationen (name) VALUES ($1)", [datei]);
      await client.query("COMMIT");
      console.log(`✓ ${datei}`);
    } catch (err) {
      await client.query("ROLLBACK");
      throw new Error(`${datei}: ${err.message}`);
    } finally {
      client.release();
    }
  }
  console.log("Datenbank ist aktuell.");
} finally {
  await pool.end();
}
