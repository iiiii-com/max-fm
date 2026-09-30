/**
 * 产业链 → 东财板块 BK code 映射（一次性建立，可重复运行）。
 *
 * 背景（B11 板块互通）：
 * industry_chains.code 字段全为 NULL —— schema 预留了与东财板块的映射位，
 * 但从未填过。后果是产业链页看不到自己对应板块的实时资金流，
 * 而这恰恰是「结构 + 行情」结合最有价值的部分。
 *
 * 为什么不手写映射表：
 * 东财板块 code 形如 BK0447，属于平台内部标识，会随平台调整而变化。
 * 手写一份「看起来对」的 code 列表，一旦某个 code 漂移或写错，
 * 页面就会把**另一个板块**的资金流当成这条链的表现 ——
 * 精确、量级合理、但完全错误，比不显示危险得多。
 * 因此本脚本从东财板块接口实时发现匹配项，匹配不上的链留空。
 *
 * 匹配方式：
 *   1. 拉取东财全部板块（/api/sector/board 的数据源）
 *   2. 用产业链名做**规范化包含匹配**（去掉"产业链/产业/链"后缀再比）
 *   3. 只有在匹配唯一时才写入 —— 多个候选或零候选都留空并报告
 *
 * 运行：npx tsx scripts/fix-chain-sector-codes.ts [--dry]
 */
import { db } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { bootstrap } from "@/lib/db";

const DRY = process.argv.includes("--dry");

/** 去掉产业链名的通用后缀，得到可比对的关键词 */
function normalize(name: string): string {
  return name
    .replace(/产业链|产业链条|产业|行业|板块/g, "")
    .replace(/\s+/g, "")
    .trim();
}

async function fetchBoards(): Promise<Array<{ code: string; name: string }>> {
  const url =
    "https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=600&po=1&np=1&fltt=2&invt=2&fs=m:90+t:2&fields=f12,f14";
  const res = await fetch(url, { next: { revalidate: 600 } });
  if (!res.ok) throw new Error(`东财板块接口 ${res.status}`);
  const json: any = await res.json();
  const rows = json?.data?.diff ?? [];
  return rows
    .map((r: any) => ({ code: String(r.f12 ?? ""), name: String(r.f14 ?? "") }))
    .filter((r: { code: string; name: string }) => r.code && r.name);
}

async function main() {
  await bootstrap();
  const chains = await db.select().from(s.industryChains);
  console.log(`产业链 ${chains.length} 条`);

  let boards: Array<{ code: string; name: string }>;
  try {
    boards = await fetchBoards();
    console.log(`东财板块 ${boards.length} 个（实时发现）\n`);
  } catch (e: any) {
    console.log(`⚠ 无法获取东财板块列表：${e?.message ?? e}`);
    console.log("  本次不做任何写入。BK code 不可猜测，留空是正确处理。\n");
    return;
  }

  const matched: Array<{ slug: string; code: string; board: string }> = [];
  const unmatched: string[] = [];
  const ambiguous: string[] = [];

  for (const c of chains as any[]) {
    const kw = normalize(c.name);
    if (!kw) {
      unmatched.push(`${c.slug}(${c.name}) 名称无法规范化`);
      continue;
    }
    const hits = boards.filter((b) => normalize(b.name) === kw);
    if (hits.length === 1) {
      matched.push({ slug: c.slug, code: hits[0].code, board: hits[0].name });
    } else if (hits.length === 0) {
      // 退化：允许板块名包含关键词（"光伏设备" 含 "光伏"）
      const loose = boards.filter((b) => {
        const n = normalize(b.name);
        return n.includes(kw) || kw.includes(n);
      });
      if (loose.length === 1) {
        matched.push({ slug: c.slug, code: loose[0].code, board: loose[0].name });
      } else if (loose.length > 1) {
        ambiguous.push(`${c.slug}(${c.name}) → ${loose.map((x) => x.name).join("/")}`);
      } else {
        unmatched.push(`${c.slug}(${c.name}) 无匹配板块`);
      }
    } else {
      ambiguous.push(`${c.slug}(${c.name}) → ${hits.map((x) => x.name).join("/")}`);
    }
  }

  console.log(`唯一匹配 ${matched.length} 条:`);
  for (const m of matched) console.log(`  ${m.slug.padEnd(12)} ${m.code}  ${m.board}`);
  if (ambiguous.length) {
    console.log(`\n多候选、需人工判定 ${ambiguous.length} 条（不写入）:`);
    ambiguous.forEach((a) => console.log(`  ${a}`));
  }
  console.log(`\n无匹配 ${unmatched.length} 条（保持为空）:`);
  unmatched.forEach((u) => console.log(`  ${u}`));

  if (DRY) {
    console.log("\n(dry-run，未落库)");
    return;
  }

  for (const m of matched) {
    await db.update(s.industryChains).set({ code: m.code }).where(eq(s.industryChains.slug, m.slug));
  }
  console.log(`\n已写入 ${matched.length} 条 code（其余保持 NULL，页面不展示资金流入口）`);
}

main();
