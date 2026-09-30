/**
 * 一次性迁移：清空 industry_chains.detail 中旧的无源规模表述。
 *
 * 背景：seed 曾写入形如
 *   "市场规模约 1.3 万亿元，国产化率不足 30%"
 *   "低空经济规模超 5000 亿元，2030 年目标 2 万亿元"
 * 的 detail 字段。这些句子没有统计时点、没有来源、没有口径，
 * 属于"看起来有信息量、实际无法核验"的表述，与已清空的
 * chain_nodes.value/growth 是同一种病。
 *
 * 新 seed 写入的是定性跟踪指标清单（CHAIN_NOTES），不含数字。
 * 本脚本把存量里仍带数字的 detail 置空，让页面对这些链显示
 * 「暂无已核验数据」，而不是继续展示无法核验的规模。
 *
 * 幂等。用法：npx tsx scripts/fix-chain-notes.ts [--dry]
 */
import { db, bootstrap } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const DRY = process.argv.includes("--dry");

/** detail 里出现这些形态就认为含无源数字 */
const HAS_NUMBER = /\d[\d.,]*\s*(万亿|亿|万|%|GW|万吨|万辆|亿美元|万台|个)/;

async function main() {
  await bootstrap();
  const rows = (await db.select().from(s.industryChains)) as any[];
  console.log(`industry_chains 共 ${rows.length} 条`);

  const offenders = rows.filter((r) => r.detail && HAS_NUMBER.test(String(r.detail)));
  console.log(`\n含无源数字的 detail ${offenders.length} 条：`);
  for (const r of offenders) {
    console.log(`  ${String(r.name).padEnd(14)} ${String(r.detail).slice(0, 56)}`);
  }

  if (offenders.length && !DRY) {
    // 逐条按主键精确更新，不用无谓条件的批量语句
    for (const r of offenders) {
      await db.update(s.industryChains).set({ detail: null }).where(eq(s.industryChains.id, r.id));
    }
  }

  const after = (await db.select().from(s.industryChains)) as any[];
  const left = after.filter((r) => r.detail && HAS_NUMBER.test(String(r.detail)));
  console.log(`\n${DRY ? "[dry] 仍有" : "复核：仍有"} ${left.length} 条含无源数字（应为 0）`);
  if (!DRY && left.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error("失败:", e);
  process.exit(1);
});
