/**
 * 把 70 城房价快照导入数据库，并建立与站内城市清单的匹配关系。
 *
 * 为什么要有匹配这一步：
 * 房价快照用国家统计局的 70 城标准名（如"呼和浩特""秦皇岛"），
 * 而站内城市清单是自维护的 67 城（含"鄂尔多斯""克拉玛依""大庆"等
 * 不在 70 城统计范围内的城市）。两者名字不完全一致，
 * 且 70 城里也有站内没有的（秦皇岛、丹东、锦州、牡丹江…）。
 *
 * 匹配规则（保守，宁可不匹配也不错配）：
 *   1. 去掉"市/地区"后缀后完全相等
 *   2. 不做模糊匹配 —— 错配会把另一个城市的价格指数按到本城上，
 *      数字精确、量级合理，读者无从怀疑，比留空危险得多
 * 未匹配上的城市在页面上显示「不在国家统计局 70 城统计范围」并说明原因。
 *
 * 运行：npx tsx scripts/import-house-price.ts [--dry]
 */
import { db, uid, bootstrap } from "@/lib/db";
import * as s from "@/lib/db/schema";
import {
  loadHousePriceSnapshot,
  siteCities,
  type HousePriceSnapshot,
} from "@/lib/data/housePriceSnapshot";

const DRY = process.argv.includes("--dry");

async function main() {
  await bootstrap();
  // 读盘与匹配规则统一放在 lib/data/housePriceSnapshot，
  // 与接口的快照兜底共用同一份实现，避免两处口径漂移。
  const snap = loadHousePriceSnapshot() as HousePriceSnapshot;
  if (!snap) {
    console.error("未找到 data/snapshots/house-price-70.json，请先运行 fetch-house-price-70.ts");
    process.exit(1);
  }

  const mine = siteCities();
  const official = snap.rows.map((r) => r.city);
  const byName = new Map(snap.rows.map((r) => [r.city, r]));

  const matched: Array<{ site: string; official: string }> = [];
  const unmatched: string[] = [];
  for (const c of mine) {
    const hit = official.find((o) => o === c);
    if (hit) matched.push({ site: c, official: hit });
    else unmatched.push(c);
  }
  const notOnSite = official.filter((o) => !mine.includes(o));

  console.log(`数据期 ${snap.period} | 快照 ${official.length} 城 | 站内 ${mine.length} 城`);
  console.log(`\n匹配成功 ${matched.length} 城:`);
  console.log("  " + matched.map((m) => m.site).join(" "));
  console.log(`\n站内有、70城无（${unmatched.length}）—— 将显示「不在国家统计局 70 城统计范围」:`);
  console.log("  " + unmatched.join(" "));
  console.log(`\n70城有、站内无（${notOnSite.length}）—— 不导入:`);
  console.log("  " + notOnSite.join(" "));

  if (DRY) {
    console.log("\n(dry-run，未落库)");
    return;
  }

  // 表结构由 bootstrap 统一创建（lib/db/index.ts 的 TABLES + COLS_SQLITE），
  // 本脚本**不再自行 CREATE TABLE**。
  // 原因：曾在这里写过一个 8 列的独立建表语句（city 作 PRIMARY KEY），
  // 与共享 schema（id 作 PRIMARY KEY、80 列）冲突；且 drizzle 的
  // db.run(sql`CREATE TABLE ...`) 对 DDL 并不生效 —— 表现为语句"跑过了"
  // 但表根本没建 / 列缺失。现在只依赖 bootstrap，并用「清空 + 批量插入」
  // 代替 upsert（这张表是已发布数据的本地缓存，整表重建语义更简单也更幂等，
  // 不需要 city 上有 UNIQUE 约束）。
  await db.delete(s.cityHousePrice);

  if (matched.length) {
    await db.insert(s.cityHousePrice).values(
      matched.map((m) => {
        const r = byName.get(m.official)!;
        return {
          id: uid("chp"),
          city: m.site,
          period: snap.period,
          newMom: r.newMom,
          newYoy: r.newYoy,
          usedMom: r.usedMom,
          usedYoy: r.usedYoy,
          sourceUrl: snap.sourceUrl,
          fetchedAt: snap.fetchedAt,
          updatedAt: Date.now(),
        };
      })
    );
  }
  const n = await db.select().from(s.cityHousePrice);
  console.log(`\n已写入 city_house_price ${n.length} 行（期间 ${snap.period}）`);
}

main();
