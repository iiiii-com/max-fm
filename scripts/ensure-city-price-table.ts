/**
 * 检查并修复 city_house_price 表结构。
 *
 * 问题：该表在一版 COLS_SQLITE 里被 CREATE 出来时，列清单还没包含
 * city / period / new_mom 等字段。bootstrap 用 CREATE TABLE IF NOT EXISTS，
 * **不会**给已存在的表补列，后续插入即报
 * "table city_house_price has no column named id"（实际缺的是新增列）。
 *
 * 该表是「统计局已发布数据」的本地缓存（每次抓取整表重建），
 * 结构不对时直接 DROP 重建 —— 不存在需要保留的用户写入。
 *
 * 关键点：不能靠第二次调用 bootstrap() 重建表。它是模块级单例守卫，
 * 同一进程内第二次调用是 no-op，表根本不会被创建。因此这里直接执行
 * 与 lib/db/index.ts 中 DDL_SQLITE 同构的建表语句。
 *
 * 运行：npx tsx scripts/ensure-city-price-table.ts [--dry]
 */
import { db, raw, bootstrap, isPg } from "@/lib/db";
import { sql } from "drizzle-orm";

const DRY = process.argv.includes("--dry");
const TABLE = "city_house_price";
const NEEDED = [
  "id", "city", "period", "new_mom", "new_yoy", "used_mom", "used_yoy",
  "source_url", "fetched_at", "updated_at",
];

/** 与 DDL_SQLITE 同构的完整列清单（保持两处一致，否则会出现同类缺列问题） */
const DDL_COLS =
  "id TEXT PRIMARY KEY, uid TEXT, name TEXT, email TEXT, password_hash TEXT, provider TEXT, " +
  "risk_level TEXT, interests TEXT, plan TEXT, title TEXT, slug TEXT, department TEXT, category TEXT, " +
  "summary TEXT, content TEXT, popular TEXT, professional TEXT, data_links TEXT, tags TEXT, status TEXT, " +
  "source TEXT, source_model TEXT, quality_score TEXT, unit TEXT, type TEXT, date TEXT, publish_date TEXT, " +
  "source_url TEXT, answers TEXT, components TEXT, detail TEXT, chain_id TEXT, level TEXT, companies TEXT, " +
  "description TEXT, code TEXT, symbol TEXT, value REAL, growth REAL, sentiment TEXT, score REAL, " +
  "temperature REAL, temperature_diff REAL, price REAL, change_pct REAL, change_amount REAL, open REAL, " +
  "high REAL, low REAL, volume REAL, amount REAL, year INTEGER, gdp REAL, per_capita_gdp REAL, " +
  "population REAL, fiscal_revenue REAL, trade REAL, sample_count INTEGER, avg_score REAL, " +
  "duration_ms INTEGER, tokens INTEGER, created_at INTEGER, updated_at INTEGER, province TEXT, " +
  "dimension TEXT, bucket TEXT, age_group TEXT, occupation TEXT, region TEXT, task_name TEXT, " +
  "n INTEGER, link_id TEXT, connected_to TEXT, city TEXT, period TEXT, new_mom REAL, new_yoy REAL, " +
  "used_mom REAL, used_yoy REAL, fetched_at INTEGER";

function toRows(res: any): any[] {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.results)) return res.results;
  if (Array.isArray(res?.rows)) return res.rows;
  return [];
}

async function main() {
  await bootstrap();

  const before = toRows(await db.run(sql`PRAGMA table_info(${sql.raw(TABLE)})`));
  const have = new Set(before.map((r: any) => r.name));
  const missing = NEEDED.filter((c) => !have.has(c));

  if (!before.length) {
    console.log(`表 ${TABLE} 不存在 → 直接创建`);
  } else {
    console.log(`表 ${TABLE} 现有 ${before.length} 列，缺少: ${missing.join(", ") || "无"}`);
    if (!missing.length) {
      console.log("结构完整，无需处理");
      return;
    }
  }

  if (DRY) {
    console.log("(dry-run，未改动)");
    return;
  }

  await db.run(sql`DROP TABLE IF EXISTS ${sql.raw(TABLE)}`);
  // 用 raw 连接直接执行 DDL：drizzle 的 db.run + sql.raw 组合对 DDL 不生效
  // （表现为 PRAGMA 仍返回 0 列，而语句"看起来执行了"）。lib/db/index.ts 的
  // bootstrap 也是走 raw.exec / raw.query，这里保持一致。
  if (isPg) {
    await raw.query(`CREATE TABLE ${TABLE} (${DDL_COLS});`);
  } else {
    raw.exec(`CREATE TABLE ${TABLE} (${DDL_COLS});`);
  }

  const after = isPg
    ? (await raw.query(`SELECT column_name AS name FROM information_schema.columns WHERE table_name = $1`, [TABLE]))?.rows ?? []
    : (raw.prepare(`PRAGMA table_info(${TABLE})`).all() as any[]);
  const stillMissing = NEEDED.filter((c) => !after.some((r: any) => r.name === c));
  console.log(`重建完成：${after.length} 列 | 仍缺少: ${stillMissing.join(", ") || "无"}`);
}

main();