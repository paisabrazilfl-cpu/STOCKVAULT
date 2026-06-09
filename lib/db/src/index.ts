import { drizzle } from "drizzle-orm/node-postgres";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

/**
 * Lazy DB init.
 *
 * Importing this module must NOT throw — otherwise a missing DATABASE_URL
 * crashes the entire API process at boot, Render's health check never passes,
 * and the service shows `x-render-routing: no-server` with no way to diagnose
 * it. Instead we defer creation of the pool/connection until the first query,
 * so the server boots, /api/healthz responds, and only DB-backed routes fail
 * (gracefully, via their error handlers) when the database is unconfigured.
 */
function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL must be set. Did you forget to provision a database? " +
        "On Render, deploy via the render.yaml Blueprint (which provisions " +
        "Postgres and wires DATABASE_URL) or add the env var manually.",
    );
  }
  return url;
}

let _pool: pg.Pool | undefined;
let _db: NodePgDatabase<typeof schema> | undefined;

function getPool(): pg.Pool {
  if (!_pool) _pool = new Pool({ connectionString: requireDatabaseUrl() });
  return _pool;
}

function getDb(): NodePgDatabase<typeof schema> {
  if (!_db) _db = drizzle(getPool(), { schema });
  return _db;
}

// Proxies forward every access to the lazily-created real instances, so all
// existing `db.select(...)` / `pool.query(...)` call sites keep working while
// initialization is deferred to first use.
export const pool: pg.Pool = new Proxy({} as pg.Pool, {
  get(_t, prop) {
    const target = getPool() as unknown as Record<string | symbol, unknown>;
    const value = target[prop];
    return typeof value === "function" ? value.bind(target) : value;
  },
});

export const db: NodePgDatabase<typeof schema> = new Proxy(
  {} as NodePgDatabase<typeof schema>,
  {
    get(_t, prop) {
      const target = getDb() as unknown as Record<string | symbol, unknown>;
      const value = target[prop];
      return typeof value === "function" ? value.bind(target) : value;
    },
  },
);

export * from "./schema";
