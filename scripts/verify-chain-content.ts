import { db, bootstrap } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { CHAIN_INSIGHTS } from "@/lib/data/chainInsights";
import { CHAIN_NODE_INSIGHTS } from "@/lib/data/chainNodeInsights";
import { CHAIN_ECONOMICS } from "@/lib/data/chainEconomics";
import { CHAIN_CAREERS } from "@/lib/data/chainCareers";

/**
 * 产业链解读覆盖度与字段完整性校验。
 * 目的：新增产业链或漏写字段时立刻发现，而不是等读者点进页面才发现空白。
 */
async function main() {
  await bootstrap();
  const chains = (await db.select().from(s.industryChains)) as any[];
  const slugs = chains.map((c) => c.slug);

  const problems: string[] = [];

  for (const slug of slugs) {
    if (!CHAIN_INSIGHTS[slug]?.economics) problems.push(`${slug}: 缺链级解读`);
    if (!CHAIN_ECONOMICS[slug]?.profitMap) problems.push(`${slug}: 缺利润地图`);
    if (!CHAIN_ECONOMICS[slug]?.trend) problems.push(`${slug}: 缺趋势`);
    if (!CHAIN_ECONOMICS[slug]?.drivers?.length) problems.push(`${slug}: 缺驱动力`);
    if (!CHAIN_ECONOMICS[slug]?.constraints?.length) problems.push(`${slug}: 缺制约`);
    const c = CHAIN_CAREERS[slug];
    if (!c?.hiring) problems.push(`${slug}: 缺用人结构`);
    if (!c?.payDrivers?.length) problems.push(`${slug}: 缺薪资变量`);
    if (!c?.roles?.length) problems.push(`${slug}: 缺岗位`);
    for (const r of c?.roles ?? []) {
      if (!r.title || !r.work || !r.threshold || !r.pay) {
        problems.push(`${slug}: 岗位「${r.title ?? "?"}」字段不全`);
      }
    }
  }

  // 岗位数量下限：太少说明只写了泛泛一两个岗位
  const thin = slugs.filter((s) => (CHAIN_CAREERS[s]?.roles?.length ?? 0) < 3);
  if (thin.length) problems.push(`岗位少于 3 个: ${thin.join(" ")}`);

  // 节点解读覆盖（稀土与 CPO 的描述内联在 seed 里，不在本表）
  const inlineOk = new Set(["rare-earth", "cpo"]);
  const noNode = slugs.filter(
    (x) => !CHAIN_NODE_INSIGHTS[x] && !inlineOk.has(x)
  );
  if (noNode.length) problems.push(`节点解读缺失: ${noNode.join(" ")}`);

  console.log(`产业链: ${slugs.length} 条`);
  console.log(`岗位总数: ${slugs.reduce((n, x) => n + (CHAIN_CAREERS[x]?.roles?.length ?? 0), 0)}`);
  if (problems.length) {
    console.log(`\n问题 ${problems.length} 项:`);
    for (const p of problems) console.log("  - " + p);
    process.exitCode = 1;
  } else {
    console.log("\n全部通过：每条链都有利润地图、趋势、驱动力/制约、用人结构、薪资变量与 ≥3 个完整岗位");
  }
}
main();