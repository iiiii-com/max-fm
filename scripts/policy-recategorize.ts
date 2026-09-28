/**
 * 一次性回填脚本：给已入库的政策重新打分类
 *
 * 背景：历史数据里所有部委条目都被写成「部委公告 / 央行公告」这类不参与筛选的通用桶，
 * 导致「货币政策 / 财政 / 资本市场 / 房地产」等筛选分类几乎为空。
 * 本脚本复用 policy-sync 的同一个分类器，对全表做一次幂等回填。
 *
 * 运行：npx tsx scripts/policy-recategorize.ts
 */
import { db } from "@/lib/db";
import * as s from "@/lib/db/schema";

/** 与 lib/data/policy-sync.ts 中的 classifyPolicy 保持一致 */
function classifyPolicy(title: string, dept: string): string {
  const t = String(title ?? "");
  if (dept === "中国人民银行") return "货币政策";
  if (dept === "财政部") {
    if (/税|增值税|所得税|关税|退税/.test(t)) return "财税";
    if (/金融|银行|证券|保险|资本市场|直接融资/.test(t)) return "资本市场";
    return "财政";
  }
  if (dept === "国家发展改革委") {
    if (/价格|物价|收费/.test(t)) return "财税";
    return "产业政策";
  }
  if (/资本市场|证券|交易所|退市|IPO|再融资|上市公司/.test(t)) return "资本市场";
  if (/货币|利率|降准|降息|存款准备金|公开市场|流动性|再贷款/.test(t)) return "货币政策";
  if (/财政|预算|国债|转移支付|专项债|减税/.test(t)) return "财政";
  if (/税|增值税|所得税|关税|退税/.test(t)) return "财税";
  if (/房地产|楼市|商品房|住房|公积金|土地/.test(t)) return "房地产";
  if (/消费|零售|家电|以旧换新|促消费|文旅/.test(t)) return "消费促进";
  if (/开放|外资|外贸|进出口|关税|自贸/.test(t)) return "对外开放";
  if (/改革|体制|机制|试点/.test(t)) return "改革";
  if (/民生|医疗|教育|社保|就业|养老|生育/.test(t)) return "民生";
  return "部委公告";
}

const RECLASSIFY = new Set(["部委公告", "央行公告", "官方政策"]);

async function main() {
  const rows = (await db.select().from(s.policies)) as any[];
  const byCat = new Map<string, number>();
  let changed = 0;
  let kept = 0;

  for (const r of rows) {
    const before = String(r.category ?? "");
    if (!RECLASSIFY.has(before)) {
      // 已有明确分类的条目不动（避免把人工归好的类别冲掉）
      byCat.set(before, (byCat.get(before) ?? 0) + 1);
      kept++;
      continue;
    }
    const next = classifyPolicy(r.title ?? "", r.department ?? "");
    byCat.set(next, (byCat.get(next) ?? 0) + 1);
    if (next === before) continue;
    await db.update(s.policies).set({ category: next, updatedAt: Date.now() } as any).where(
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      (await import("drizzle-orm")).eq(s.policies.id, r.id)
    );
    changed++;
  }

  console.log(`[recategorize] total=${rows.length} changed=${changed} kept=${kept}`);
  console.log("[recategorize] 分类分布：");
  for (const [k, v] of [...byCat.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(8, "　")} ${v}`);
  }
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error("[recategorize] failed:", e);
    process.exit(1);
  }
);
