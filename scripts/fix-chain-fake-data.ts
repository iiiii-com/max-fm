/**
 * 一次性数据修复：产业链假数据清理。
 *
 * 背景（三个问题，都已在新写入路径修好，这里只清理存量）：
 *  1. chain_nodes.value / growth 全部来自 seed.ts 里的 rng() 随机采样，
 *     却在详情页被当作权威数据渲染并带涨跌色。→ 置空。
 *  2. 18 个 `关联：XXX` 节点被写成 level:"下游"，冒充产业链下游环节，
 *     导致图上出现「中游供给消费电子」这类不存在的供给关系，
 *     且概览卡（过滤后 6 个）与头部（未过滤 9 个）同屏矛盾。→ 改为 LINK_LEVEL。
 *  3. 环节计数需要统一到「真实环节」口径。→ 本脚本顺带打印口径基线。
 *
 * 幂等：可重复运行。
 * 运行：npx tsx scripts/fix-chain-fake-data.ts [--dry]
 */
import { db } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { LINK_LEVEL, LEVELS, isRealLevel } from "@/lib/data/chainLevels";

const DRY = process.argv.includes("--dry");

async function main() {
  const rows = await db.select().from(s.chainNodes);
  console.log(`chain_nodes 存量 ${rows.length} 条`);

  // ---- 1. 关联节点改伪层级 ----
  const linkNodes = rows.filter((r: any) => isRealLevel(r.level) && String(r.name ?? "").startsWith("关联："));
  console.log(`\n[1] 「关联：」节点 ${linkNodes.length} 个（level 冒充为真实层级）`);
  if (!DRY) {
    for (const n of linkNodes) {
      await db.update(s.chainNodes).set({ level: LINK_LEVEL } as any).where(eq(s.chainNodes.id, n.id));
    }
  }
  for (const n of linkNodes.slice(0, 4)) console.log(`    ${n.name}  ${n.level} → ${LINK_LEVEL}`);

  // ---- 2. 随机 value / growth 置空 ----
  const withNum = rows.filter((r: any) => r.value != null || r.growth != null);
  console.log(`\n[2] 含随机规模/增速的节点 ${withNum.length} 个 → 置空`);
  if (withNum.length && !DRY) {
    await db.update(s.chainNodes).set({ value: null, growth: null } as any);
  }
  for (const r of withNum.slice(0, 4)) {
    console.log(`    ${String(r.name).padEnd(12)} 规模 ${r.value} 亿 / 增速 ${r.growth}%  →  null / null`);
  }

  // ---- 3. 计数口径基线 ----
  const chains = await db.select().from(s.industryChains);
  console.log(`\n[3] 计数口径（真实环节 = level 属于 ${LEVELS.join("/")}）`);
  let mismatch = 0;
  for (const c of chains) {
    const ns = rows.filter((r: any) => r.chainId === c.id);
    const real = ns.filter((r: any) => isRealLevel(r.level) && !String(r.name ?? "").startsWith("关联："));
    if (ns.length !== real.length) {
      mismatch++;
      if (mismatch <= 6) console.log(`    ${String(c.name).padEnd(14)} 全部 ${ns.length}  →  真实环节 ${real.length}`);
    }
  }
  console.log(`    共 ${chains.length} 条链，其中 ${mismatch} 条存在口径差（旧代码会因此显示不一致的两个数字）`);

  // ---- 4. 复核 ----
  const after = await db.select().from(s.chainNodes);
  const stillNum = after.filter((r: any) => r.value != null || r.growth != null);
  const stillFake = after.filter((r: any) => isRealLevel(r.level) && String(r.name ?? "").startsWith("关联："));
  const realTotal = after.filter((r: any) => isRealLevel(r.level) && !String(r.name ?? "").startsWith("关联：")).length;
  console.log(`\n复核：含数字的节点 ${stillNum.length}（应为 0） · 冒充层级的关联节点 ${stillFake.length}（应为 0）`);
  console.log(`真实环节总数 ${realTotal} / 节点总数 ${after.length}`);

  if (!DRY && (stillNum.length || stillFake.length)) {
    console.error("仍有残留，未达预期。");
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error("失败:", e);
  process.exit(1);
});
