/**
 * 政策摘要回填：用 lib/data/policy-sync.ts 的 cleanSummary 清洗历史存量摘要。
 *
 * 背景：cleanSummary 是后来才加的（丢弃开头的残句、按句读截断）。
 * 它只对**新同步**的条目生效，库里已有的存量摘要仍是「半句话」开头，
 * 于是政策列表上出现「……等有关措施的通知」这类断头文案。
 *
 * 用法：
 *   npx tsx scripts/policy-backfill-summaries.ts [--dry]
 */
import path from "node:path";
import { eq, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import * as s from "@/lib/db/schema";

const DRY = process.argv.includes("--dry");

/**
 * 与 policy-sync.ts 中 cleanSummary 保持一致的逻辑。
 * 这里刻意复制而非 import：cleanSummary 目前不是 export，
 * 改成 export 会把同步模块的内部实现变成公共 API。
 * 若两边行为出现分歧，以 policy-sync.ts 为准（它是写入侧的唯一事实来源）。
 */
function stripHtml(text: string): string {
  return text
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function cleanSummary(text: string, maxLen = 110): string {
  let s = stripHtml(text ?? "");
  // 与 policy-sync.ts 保持一致：丢弃首句的前提是剩余内容仍够长。
  // 若缺这个约束，短摘要会被 slice 成空串（存量 164 条中 46 条命中）。
  const MIN_AFTER_DROP = 24;
  const firstStop = s.search(/[。！？；]/);
  if (firstStop > 0 && firstStop < 24 && s.length - (firstStop + 1) >= MIN_AFTER_DROP) {
    s = s.slice(firstStop + 1);
  }
  s = s.replace(/^[，、。；：\s]+/, "").trim();
  if (!s) return "";
  if (s.length <= maxLen) return s;
  const cut = s.slice(0, maxLen);
  const lastStop = Math.max(
    cut.lastIndexOf("。"),
    cut.lastIndexOf("；"),
    cut.lastIndexOf("！"),
    cut.lastIndexOf("？")
  );
  return (lastStop > maxLen * 0.5 ? cut.slice(0, lastStop + 1) : cut) + "…";
}

async function main() {
  const rows = await db
    .select({ id: s.policies.id, title: s.policies.title, summary: s.policies.summary })
    .from(s.policies)
    .where(isNotNull(s.policies.summary));

  console.log(`存量政策 ${rows.length} 条`);

  let changed = 0;
  const samples: string[] = [];

  for (const r of rows) {
    const before = r.summary ?? "";
    const after = cleanSummary(before);
    if (after === before) continue;
    changed++;
    if (samples.length < 5) {
      samples.push(`  ${r.title.slice(0, 26)}\n    前: ${before.slice(0, 70)}\n    后: ${after.slice(0, 70)}`);
    }
    if (!DRY) await db.update(s.policies).set({ summary: after }).where(eq(s.policies.id, r.id));
  }

  console.log(`\n${DRY ? "[dry] 将" : "已"}清洗 ${changed} 条`);
  if (samples.length) console.log("\n样例:\n" + samples.join("\n"));

  if (DRY) {
    const after = (rows as Array<{ id: string; title: string; summary: string | null }>).map((r: { summary: string | null }) => cleanSummary(r.summary ?? ""));
    console.log(`\n[dry] 清洗后为空字符串的条目: ${after.filter((x: string) => !x).length}（必须为 0）`);
    return;
  }

  // 复核必须重新读库：上面 rows 持有的是**更新前**的值，直接拿它算会把旧状态当成新状态。
  const after = await db
    .select({ id: s.policies.id, summary: s.policies.summary })
    .from(s.policies)
    .where(isNotNull(s.policies.summary));
  const emptied = after.filter((r: { id: string; summary: string | null }) => !String(r.summary ?? "").trim());
  console.log(`\n清洗后为空字符串的条目: ${emptied.length}（必须为 0）`);
  if (emptied.length) {
    console.error("存在被清空的摘要，请立即回滚。");
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error("失败:", e);
  process.exit(1);
});
