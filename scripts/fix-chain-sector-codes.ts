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

/**
 * 人工确认过的产业链 → 板块映射（chain_slug → 东财 BK code）。
 * 只放「链名与板块名不完全一致、但确实是这条链对应板块」的条目，
 * 且必须已经看过 dry-run 报告里的候选再填进来。改错这里等于把别人的行情当这条链。
 */
const APPROVED: Record<string, string> = {
  nev: "BK1211", // 新能源汽车 → 汽车（行业板块口径最接近）
  finance: "BK1283", // 银行保险 → 银行（保险未单列，口径偏窄，已知取舍）
  "rare-earth": "BK1626", // 稀土永磁 → 稀土
  "media-game": "BK0486", // 传媒游戏 → 传媒
  "sodium-battery": "BK1033", // 钠离子电池 → 电池
  "innov-device": "BK1041", // 创新医疗器械 → 医疗器械
  // 刻意不收：gpu-cloud 算力租赁 → BK1365「租赁」。租赁行业与算力租赁无关，属误配。
};

/** 去掉产业链名的通用后缀，得到可比对的关键词 */
function normalize(name: string): string {
  return name
    .replace(/产业链|产业链条|产业|行业|板块/g, "")
    .replace(/\s+/g, "")
    .trim();
}

/** 东财 clist 会拒掉 Node 默认 UA（fetch failed），必须带浏览器 UA（与站内接口一致） */
const UA = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36" };

async function fetchBoards(): Promise<Array<{ code: string; name: string }>> {
  // push2 主机对本机连接会间歇性重置（UND_ERR_SOCKET），连续翻页尤其容易触发。
  // 板块列表是低频变动数据（数百个行业板块，名字/code 极少变化），
  // 所以落一份磁盘缓存：24h 内复用，重试失败也不阻塞整个回填。
  const CACHE = "data/sector-boards.json";
  const TTL = 24 * 3600 * 1000;
  if (!process.argv.includes("--refresh")) {
    try {
      const fs = await import("node:fs");
      const st = fs.statSync(CACHE);
      if (Date.now() - st.mtimeMs < TTL) {
        const cached = JSON.parse(fs.readFileSync(CACHE, "utf8")) as Array<{ code: string; name: string }>;
        if (cached.length) {
          console.log(`[cache] 复用 ${CACHE}（${cached.length} 个板块，${Math.round((Date.now() - st.mtimeMs) / 60000)} 分钟前抓取）`);
          return cached;
        }
      }
    } catch {
      // 无缓存或已过期 → 走网络
    }
  }

  // 东财 clist 单页最多返回 100 条，pz 给再大也只回一页。
  // 原实现只取 pn=1，100 个板块里有大量产业链因此匹配不上（AI/机器人/储能…）。
  const getPage = async (pn: number) => {
    const url =
      `https://push2.eastmoney.com/api/qt/clist/get?pn=${pn}&pz=100&po=1&np=1&fltt=2&invt=2` +
      `&fs=m:90+t:2&fields=f12,f14`;
    // 上游限频是常态，退避重试 4 次（约 30 秒窗口）
    let lastErr: unknown;
    for (const wait of [2000, 6000, 12000, 20000]) {
      try {
        const res = await fetch(url, { headers: UA, next: { revalidate: 600 }, signal: AbortSignal.timeout(15000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return ((await res.json()) as any)?.data?.diff ?? [];
      } catch (e) {
        lastErr = e;
        await new Promise((r) => setTimeout(r, wait));
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
  };

  const seen = new Map<string, { code: string; name: string }>();
  for (let pn = 1; pn <= 20; pn++) {
    const rows = (await getPage(pn)) as any[];
    if (!rows.length) break;
    for (const r of rows) {
      const code = String(r.f12 ?? "");
      const name = String(r.f14 ?? "");
      if (code && name) seen.set(code, { code, name });
    }
    if (rows.length < 100) break; // 最后一页
    await new Promise((r) => setTimeout(r, 300)); // 页间留白，别把自己打到限频
  }

  const list = [...seen.values()];
  if (list.length) {
    const fs = await import("node:fs");
    fs.mkdirSync("data", { recursive: true });
    fs.writeFileSync(CACHE, JSON.stringify(list, null, 0));
    console.log(`[cache] 已写入 ${CACHE}（${list.length} 个板块）`);
  }
  return list;
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
  const review: string[] = [];

  for (const c of chains as any[]) {
    const kw = normalize(c.name);
    if (!kw) {
      unmatched.push(`${c.slug}(${c.name}) 名称无法规范化`);
      continue;
    }

    // 1) 人工确认过的映射优先（唯一允许写入「非精确」匹配的地方）
    const approved = APPROVED[c.slug];
    if (approved) {
      const hit = boards.find((b) => b.code === approved);
      if (hit) {
        matched.push({ slug: c.slug, code: hit.code, board: `${hit.name}（人工确认）` });
        continue;
      }
      review.push(`${c.slug}(${c.name}) 人工映射 ${approved} 在当前板块列表中已不存在，需复核`);
      continue;
    }

    const exact = boards.filter((b) => normalize(b.name) === kw);
    if (exact.length === 1) {
      matched.push({ slug: c.slug, code: exact[0].code, board: exact[0].name });
      continue;
    }
    if (exact.length > 1) {
      ambiguous.push(`${c.slug}(${c.name}) → ${exact.map((x) => x.name).join("/")}`);
      continue;
    }

    // 2) 板块名包含链关键词（"光伏设备" 含 "光伏"）：方向安全，可自动写入
    const forward = boards.filter((b) => normalize(b.name).includes(kw));
    if (forward.length === 1) {
      matched.push({ slug: c.slug, code: forward[0].code, board: forward[0].name });
      continue;
    }
    if (forward.length > 1) {
      ambiguous.push(`${c.slug}(${c.name}) → ${forward.map((x) => x.name).join("/")}`);
      continue;
    }

    // 3) 反向（链名包含板块名）：只报告不写入。
    //    "算力租赁产业" 命中板块"租赁"就是这一档 —— 精确、量级合理、完全错误。
    //    每条都需人工确认后写进上面的 APPROVED，绝不在这里自动落库。
    const reverse = boards.filter((b) => {
      const n = normalize(b.name);
      return n.length >= 2 && kw.includes(n);
    });
    if (reverse.length) {
      review.push(
        `${c.slug}(${c.name}) → 候选 ${reverse.map((x) => `${x.name}(${x.code})`).join("/")}`
      );
      continue;
    }

    unmatched.push(`${c.slug}(${c.name}) 无匹配板块`);
  }

  console.log(`唯一匹配 ${matched.length} 条:`);
  for (const m of matched) console.log(`  ${m.slug.padEnd(12)} ${m.code}  ${m.board}`);
  if (ambiguous.length) {
    console.log(`\n多候选、需人工判定 ${ambiguous.length} 条（不写入）:`);
    ambiguous.forEach((a) => console.log(`  ${a}`));
  }
  if (review.length) {
    console.log(`\n反向候选、需人工确认 ${review.length} 条（不写入，确认后填进 APPROVED）:`);
    review.forEach((r) => console.log(`  ${r}`));
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
