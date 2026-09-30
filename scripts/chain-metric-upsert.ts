/**
 * 产业链指标入库脚本。
 *
 * 行为：读取 lib/data/chainMetricSeed.ts 的首批数据，
 * 逐条过 chainMetrics.validateMetric 的三件套校验，
 * **不通过的直接拒绝入库并报错**，通过的 upsert。
 *
 * 这道闸的意义：半年后有人想再加一批数字时，
 * 少单位 / 少时点 / 少来源的数据会被挡下来，而不是静悄悄进库。
 *
 * 用法：npx tsx scripts/chain-metric-upsert.ts [--dry]
 */
import { db, uid, now, bootstrap } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { CHAIN_METRICS } from "@/lib/data/chainMetricSeed";
import { validateMetric } from "@/lib/data/chainMetrics";

const DRY = process.argv.includes("--dry");

async function main() {
  // 建表（CREATE TABLE IF NOT EXISTS，幂等）
  await bootstrap();

  console.log(`待入库 ${CHAIN_METRICS.length} 条\n`);

  const bad: Array<{ i: number; reason: string; row: (typeof CHAIN_METRICS)[number] }> = [];
  for (const [i, m] of CHAIN_METRICS.entries()) {
    const v = validateMetric({
      slug: m.slug,
      type: m.type,
      name: m.name,
      value: m.value,
      unit: m.unit,
      date: m.asOf,
      source: m.source,
      sourceUrl: m.sourceUrl,
      detail: m.caliber,
    });
    if (!v.ok) bad.push({ i, reason: v.reason ?? "", row: m });
  }

  if (bad.length) {
    console.error(`✗ ${bad.length} 条未通过三件套校验，拒绝入库：\n`);
    for (const b of bad) console.error(`  #${b.i} ${b.row.slug}/${b.row.type} — ${b.reason}`);
    process.exit(1);
  }
  console.log("✓ 全部通过校验\n");

  let upserted = 0;
  for (const m of CHAIN_METRICS) {
    const existing = await db
      .select({ id: s.chainMetrics.id })
      .from(s.chainMetrics)
      .where(and(eq(s.chainMetrics.slug, m.slug), eq(s.chainMetrics.type, m.type)))
      .limit(1);

    if (existing[0]) {
      if (!DRY) {
        await db
          .update(s.chainMetrics)
          .set({
            name: m.name,
            value: m.value,
            unit: m.unit,
            date: m.asOf,
            source: m.source,
            sourceUrl: m.sourceUrl,
            detail: m.caliber,
            updatedAt: now(),
          } as any)
          .where(eq(s.chainMetrics.id, existing[0].id));
      }
      console.log(`  ↻ 更新 ${m.slug} / ${m.name}`);
    } else {
      if (!DRY) {
        await db.insert(s.chainMetrics).values({
          id: uid("cm"),
          slug: m.slug,
          type: m.type,
          name: m.name,
          value: m.value,
          unit: m.unit,
          date: m.asOf,
          source: m.source,
          sourceUrl: m.sourceUrl,
          detail: m.caliber,
          createdAt: now(),
          updatedAt: now(),
        } as any);
      }
      console.log(`  + 新增 ${m.slug} / ${m.name}（${m.value}${m.unit}，${m.asOf}）`);
    }
    upserted++;
  }

  console.log(`\n${DRY ? "[dry] 将" : "已"}处理 ${upserted} 条`);

  const rows = await db.select().from(s.chainMetrics);
  const bySlug = new Map<string, number>();
  for (const r of rows as any[]) bySlug.set(r.slug, (bySlug.get(r.slug) ?? 0) + 1);
  console.log(`库中共 ${rows.length} 条，覆盖 ${bySlug.size} 条链：${[...bySlug.entries()].map(([k, v]) => `${k}(${v})`).join(" ")}`);
}

main().catch((e) => {
  console.error("失败:", e);
  process.exit(1);
});
