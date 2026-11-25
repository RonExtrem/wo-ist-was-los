import { Pool } from "@neondatabase/serverless";

let pool: Pool | null = null;

export function db(): Pool {
  if (!pool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL fehlt (lokal: node --env-file=.env.local …)");
    pool = new Pool({ connectionString: url, max: 3 });
  }
  return pool;
}

export async function dbSchliessen(): Promise<void> {
  if (pool) await pool.end();
  pool = null;
}
