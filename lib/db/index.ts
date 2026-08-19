import { drizzle } from "drizzle-orm/better-sqlite3";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import Database from "better-sqlite3";
import { Pool } from "pg";
import * as schema from "./schema";
import { isPg } from "./schema";
import fs from "node:fs";
import path from "node:path";

export { isPg };

function sqliteBootstrap() {
  const dir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const sqlite = new Database(path.join(dir, "max.db"));
  sqlite.pragma("journal_mode = WAL");
  const db = drizzle(sqlite, { schema });
  return { db, raw: sqlite };
}

function pgBootstrap() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzlePg(pool, { schema });
  return { db, raw: pool };
}

const boot = isPg ? pgBootstrap() : sqliteBootstrap();
export const db: any = boot.db;
export const raw: any = boot.raw;

const TABLES = [
  "economic_indicators", "policies", "policy_analyses", "articles", "industry_chains",
  "chain_nodes", "province_stats", "quotes_cache", "users", "user_advice", "watchlists",
  "feeling_surveys", "feeling_aggregates", "macro_temperature", "temperature_analyses", "task_logs",
  "history_events",
];

const COLS_SQLITE = `id TEXT PRIMARY KEY, uid TEXT, name TEXT, email TEXT, password_hash TEXT, provider TEXT, risk_level TEXT, interests TEXT, plan TEXT, title TEXT, slug TEXT, department TEXT, category TEXT, summary TEXT, content TEXT, popular TEXT, professional TEXT, data_links TEXT, tags TEXT, status TEXT, source TEXT, source_model TEXT, quality_score TEXT, unit TEXT, type TEXT, date TEXT, publish_date TEXT, source_url TEXT, answers TEXT, components TEXT, detail TEXT, chain_id TEXT, level TEXT, companies TEXT, description TEXT, code TEXT, symbol TEXT, value REAL, growth REAL, sentiment TEXT, score REAL, temperature REAL, temperature_diff REAL, price REAL, change_pct REAL, change_amount REAL, open REAL, high REAL, low REAL, volume REAL, amount REAL, year INTEGER, gdp REAL, per_capita_gdp REAL, population REAL, fiscal_revenue REAL, trade REAL, sample_count INTEGER, avg_score REAL, duration_ms INTEGER, tokens INTEGER, created_at INTEGER, updated_at INTEGER, province TEXT, dimension TEXT, bucket TEXT, age_group TEXT, occupation TEXT, region TEXT, task_name TEXT, n INTEGER, link_id TEXT, connected_to TEXT`;

const COLS_PG = COLS_SQLITE
  .replaceAll(" TEXT", " TEXT")
  .replace(/ REAL/g, " DOUBLE PRECISION")
  .replace(/ INTEGER/g, " BIGINT");

const DDL_SQLITE = TABLES.map((t) => `CREATE TABLE IF NOT EXISTS ${t} (${COLS_SQLITE});`).join("\n");

const DDL_PG = TABLES.map((t) => `CREATE TABLE IF NOT EXISTS ${t} (${COLS_PG});`).join("\n");

let bootstrapped = false;

export async function bootstrap() {
  if (bootstrapped) return;
  if (isPg) {
    await (raw as Pool).query(DDL_PG);
  } else {
    (raw as Database.Database).exec(DDL_SQLITE);
  }
  bootstrapped = true;
}

export function uid(prefix = "") {
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 8);
  return `${prefix}${t}${r}`;
}

export const now = () => Date.now();

export function parseJson<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}