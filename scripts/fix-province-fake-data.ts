/**
 * 清除省级经济数据中的随机生成字段（一次性修复，可重复运行）。
 *
 * 问题：
 * scripts/seed.ts 此前用
 *   fiscalRevenue: gdp * (0.08 + rng() * 0.03)
 *   trade:        gdp * (0.25 + rng() * 0.4)
 * 生成 31 省 8 年的「财政收入」与「进出口」—— 这两个字段是**纯随机数**，
 * 却在 /map 上以省级统计的名义展示，并可切换为地图指标。
 *
 * 表现为排名完全失真：真实数据中外贸依存度居前的是广东、浙江、江苏、福建、上海，
 * 而随机数把广东排到第 31 位（25.7%），把甘肃（64.3%）、山西、青海排到前列。
 * 这类错误比「不显示」危险得多 —— 数字看起来精确、量级合理，读者无从怀疑。
 *
 * 处理：
 *   1. 将 province_stats 的 trade / fiscal_revenue 置为 NULL（不是 0）。
 *      置 0 会被页面读成「进出口为零」，同样是假信息。
 *   2. 页面已改为：字段为空则该指标不进切换器、不进 tooltip、不参与派生计算。
 *   3. gdp / population / perCapitaGdp 保留 —— 这三个来自手写的 PROVINCES 基值，
 *      perCapitaGdp = gdp / pop 可由前两者推出，口径自洽。
 *      但 2018-2024 的 gdp / growth 是「基值倒推 + 随机扰动」的推算值，
 *      页面与回归脚本已标注为推算值。
 *
 * 运行：npx tsx scripts/fix-province-fake-data.ts [--dry]
 */
import { db } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { sql } from "drizzle-orm";
import { bootstrap } from "@/lib/db";

const DRY = process.argv.includes("--dry");

async function main() {
  await bootstrap();

  const before = await db.select().from(s.provinceStats);
  const nonNull = before.filter((r: any) => r.trade != null || r.fiscalRevenue != null);
  console.log(`province_stats 共 ${before.length} 行，其中 trade/fiscalRevenue 非空 ${nonNull.length} 行`);

  if (nonNull.length) {
    // 展示几个样例，让修复前的数据可见（便于事后核对是随机数）
    console.log("\n修复前样例（这些是随机数，不是统计值）:");
    for (const r of nonNull.filter((x: any) => x.year === 2025).slice(0, 6)) {
      console.log(
        `  ${(r as any).province}: GDP ${(r as any).gdp}万亿 进出口 ${(r as any).trade}万亿 财政 ${(r as any).fiscalRevenue}万亿`
      );
    }
  }

  if (DRY) {
    console.log("\n(dry-run，未落库)");
    return;
  }

  await db.run(sql`UPDATE province_stats SET trade = NULL, fiscal_revenue = NULL`);

  const after = await db.select().from(s.provinceStats);
  const stillNonNull = after.filter((r: any) => r.trade != null || r.fiscalRevenue != null);
  console.log(`\n修复后 trade/fiscalRevenue 非空行数：${stillNonNull.length}（应为 0）`);

  const intact = after.filter((r: any) => r.gdp != null && r.population != null).length;
  console.log(`gdp 与 population 完好行数：${intact} / ${after.length}`);

  // 自洽性抽查：perCapitaGdp 应约等于 gdp / population
  const y2025 = after.filter((r: any) => r.year === 2025) as any[];
  const drift = y2025.filter(
    (r) => r.population > 0 && Math.abs(r.perCapitaGdp - r.gdp / r.population) / (r.gdp / r.population) > 0.05
  );
  console.log(`perCapitaGdp 与 gdp/pop 偏差 >5% 的省份：${drift.length ? drift.map((r) => r.province).join(",") : "无"}`);
}

main();
