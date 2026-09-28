/**
 * 一次性修复脚本：把 publishDate 非法/残缺的政策行修好
 *
 * 背景：修 parseListPage 之前，有 20 条人民银行条目带着垃圾日期「2609」入库
 * （来自 URL 里 `20`+4 位被误拼成 `d[1]+d[2]`）。本脚本：
 *  1) 删除 publishDate 不合法的行（让下次同步重新抓，拿到正确日期）；
 *  2) 对缺日的行，用 sourceUrl 里的时间戳（YYYYMMDDHHmmss）还原日期。
 *
 * 运行：npx tsx scripts/policy-fix-dates.ts
 */
import { db } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { eq, like, or } from "drizzle-orm";

const VALID = /^20\d{2}-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?$/;

async function main() {
  const rows = (await db.select().from(s.policies)) as any[];
  let removed = 0;
  let fixed = 0;
  let kept = 0;

  for (const r of rows) {
    const d = String(r.publishDate ?? "").trim();
    if (VALID.test(d)) {
      kept++;
      continue;
    }
    // 从 URL 的时间戳还原：2026092408454713496 → 2026-09-24
    const ts = String(r.sourceUrl ?? "").match(/20(\d{2})(\d{2})(\d{2})\d{6,}/);
    if (ts) {
      const iso = `20${ts[1]}-${ts[2]}-${ts[3]}`;
      if (VALID.test(iso)) {
        await db.update(s.policies).set({ publishDate: iso } as any).where(eq(s.policies.id, r.id));
        fixed++;
        continue;
      }
    }
    // 无法还原的脏数据直接删除，交给下次同步重新抓取
    await db.delete(s.policies).where(eq(s.policies.id, r.id));
    removed++;
  }

  console.log(`[fix-dates] total=${rows.length} kept=${kept} fixed=${fixed} removed=${removed}`);

  // 复查：是否还有非法日期
  const after = (await db.select().from(s.policies)) as any[];
  const bad = after.filter((r) => !VALID.test(String(r.publishDate ?? "").trim()));
  console.log(`[fix-dates] 复查：剩余非法日期 ${bad.length} 条`);
  if (bad.length) bad.slice(0, 10).forEach((r) => console.log(`  ${r.id} ${r.publishDate} ${r.title?.slice(0, 30)}`));
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error("[fix-dates] failed:", e);
    process.exit(1);
  }
);
