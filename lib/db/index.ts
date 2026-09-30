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
  "chain_nodes", "chain_metrics", "province_stats", "quotes_cache", "users", "user_advice", "watchlists",
  "feeling_surveys", "feeling_aggregates", "macro_temperature", "temperature_analyses", "task_logs",
  "history_events",
  // 70 城商品住宅销售价格指数（国家统计局月度发布）。
  // 未在此列表中的表不会被 bootstrap 建 DDL —— 之前漏加导致
  // "table city_house_price has no column named id"（表根本没建）。
  "city_house_price",
];

const COLS_SQLITE = `id TEXT PRIMARY KEY, uid TEXT, name TEXT, email TEXT, password_hash TEXT, provider TEXT, risk_level TEXT, interests TEXT, plan TEXT, title TEXT, slug TEXT, department TEXT, category TEXT, summary TEXT, content TEXT, popular TEXT, professional TEXT, data_links TEXT, tags TEXT, status TEXT, source TEXT, source_model TEXT, quality_score TEXT, unit TEXT, type TEXT, date TEXT, publish_date TEXT, source_url TEXT, answers TEXT, components TEXT, detail TEXT, chain_id TEXT, level TEXT, companies TEXT, description TEXT, code TEXT, symbol TEXT, value REAL, growth REAL, sentiment TEXT, score REAL, temperature REAL, temperature_diff REAL, price REAL, change_pct REAL, change_amount REAL, open REAL, high REAL, low REAL, volume REAL, amount REAL, year INTEGER, gdp REAL, per_capita_gdp REAL, population REAL, fiscal_revenue REAL, trade REAL, sample_count INTEGER, avg_score REAL, duration_ms INTEGER, tokens INTEGER, created_at INTEGER, updated_at INTEGER, province TEXT, dimension TEXT, bucket TEXT, age_group TEXT, occupation TEXT, region TEXT, task_name TEXT, n INTEGER, link_id TEXT, connected_to TEXT, city TEXT, period TEXT, new_mom REAL, new_yoy REAL, used_mom REAL, used_yoy REAL, fetched_at INTEGER`;

const COLS_PG = COLS_SQLITE
  .replaceAll(" TEXT", " TEXT")
  .replace(/ REAL/g, " DOUBLE PRECISION")
  .replace(/ INTEGER/g, " BIGINT");

const DDL_SQLITE = TABLES.map((t) => `CREATE TABLE IF NOT EXISTS ${t} (${COLS_SQLITE});`).join("\n");

const DDL_PG = TABLES.map((t) => `CREATE TABLE IF NOT EXISTS ${t} (${COLS_PG});`).join("\n");

/**
 * 从 COLS_SQLITE 解析出「列名 → 列定义」，用于缺列自愈。
 *
 * 为什么需要它：本项目的所有表共用同一份超集列清单（COLS_SQLITE）。
 * 当这份清单新增列（如 city_house_price 引入的 city / period / new_mom …），
 * **已存在的表不会被 CREATE TABLE IF NOT EXISTS 补列**，
 * 于是出现「drizzle schema 声明了某列、物理表里却没有」的分裂状态：
 * 症状是构建期 `[policy-build-sync] ... table policies has no column named city`。
 *
 * 这个分裂是设计带来的系统性风险，不是单点 bug：任何一次往超集清单加列，
 * 都会让所有存量表缺列。因此在 bootstrap 里做一次幂等的 ALTER 补列，
 * 让 schema 与物理表自动收敛，避免同类问题反复出现。
 */
const COLUMN_DEFS: Array<[string, string]> = (() => {
  const out: Array<[string, string]> = [];
  for (const raw of COLS_SQLITE.split(",")) {
    const seg = raw.trim();
    if (!seg) continue;
    const m = seg.match(/^([A-Za-z_][A-Za-z0-9_]*)\s+(.+)$/);
    if (m) out.push([m[1], m[2]]);
  }
  return out;
})();

/** SQLite 侧：给每张表补齐缺失的列 */
function healSqlite() {
  const conn = raw as Database.Database;
  for (const table of TABLES) {
    const existing = new Set(
      (conn.prepare(`PRAGMA table_info(${table})`).all() as any[]).map((r) => r.name)
    );
    if (!existing.size) continue; // 表还不存在，交给上面的 CREATE
    for (const [col, def] of COLUMN_DEFS) {
      if (existing.has(col)) continue;
      // SQLite 的 ADD COLUMN 不允许 PRIMARY KEY / UNIQUE / 非空默认值，
      // 因此这里只补普通列；本超集里的新增列都是可空的，符合限制。
      const safe = def.replace(/\s+PRIMARY\s+KEY/i, "").replace(/\s+UNIQUE/i, "").replace(/\s+NOT\s+NULL/i, "");
      try {
        conn.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${safe};`);
      } catch {
        /* 已有或不可加（如 PRIMARY KEY）时忽略，不阻断启动 */
      }
    }
  }
}

/** PG 侧：给每张表补齐缺失的列 */
async function healPg() {
  const pool = raw as Pool;
  const { rows } = await pool.query<{ table_name: string; column_name: string }>(
    `SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public'`
  );
  const byTable = new Map<string, Set<string>>();
  for (const r of rows) {
    if (!byTable.has(r.table_name)) byTable.set(r.table_name, new Set());
    byTable.get(r.table_name)!.add(r.column_name);
  }
  for (const table of TABLES) {
    const have = byTable.get(table);
    if (!have) continue; // 表还不存在
    for (const [col, def] of COLUMN_DEFS) {
      if (have.has(col)) continue;
      const safe = def.replace(/\s+PRIMARY\s+KEY/i, "").replace(/\s+UNIQUE/i, "");
      try {
        await pool.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${col} ${safe};`);
      } catch {
        /* 忽略不可加的列，不阻断启动 */
      }
    }
  }
}

let bootstrapped = false;

export async function bootstrap() {
  if (bootstrapped) return;
  if (isPg) {
    await (raw as Pool).query(DDL_PG);
    await healPg();
  } else {
    (raw as Database.Database).exec(DDL_SQLITE);
    healSqlite();
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