/**
 * 产业链 → 东财板块 code 的匹配与回填。
 *
 * 为什么要有这个模块，而不是留在 scripts/ 里：
 *   本机对 push2 的连接会被间歇性掐断（UND_ERR_SOCKET），而**生产环境能正常访问**
 *   （实测线上 /api/sector/board 返回 universe.total=496）。
 *   所以回填必须能在构建时自动跑 —— 与 ndrc 链接修复同一套路，
 *   否则这个映射永远补不上，"产业链 → 板块资金流"这条数据链就一直是断的。
 *
 * 匹配纪律（宁可留空也不写错的 code）：
 *   东财 code 是平台内部标识，写错会把**另一个板块**的资金流当成这条链的表现 ——
 *   精确、量级合理、完全错误，比不显示危险得多。所以：
 *     1) 精确同名 → 写入
 *     2) 板块名包含链关键词（"光伏设备" 含 "光伏"）→ 写入；
 *        多候选取**最短名**（限定词越少越泛，正是该链的主板块），并留痕
 *     3) 反向（链名包含板名）→ 只报告不写入，除非在人工确认表里
 *     4) 名称同长度无法区分 → 进人工确认队列
 */

import { db, bootstrap } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const UA = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36",
  Referer: "https://quote.eastmoney.com/",
};

/**
 * 人工确认过的映射（chain_slug → BK code）。
 * 只放「链名与板块名不完全一致、但确实是这条链对应板块」的条目，
 * 且必须已经看过 dry-run 报告里的候选再填。改错这里等于把别人的行情当这条链。
 */
export const APPROVED: Record<string, string> = {
  nev: "BK1211", // 新能源汽车 → 汽车（行业板块口径最接近）
  finance: "BK1283", // 银行保险 → 银行（保险未单列，口径偏窄，已知取舍）
  "rare-earth": "BK1626", // 稀土永磁 → 稀土
  "media-game": "BK0486", // 传媒游戏 → 传媒
  "sodium-battery": "BK1033", // 钠离子电池 → 电池
  "innov-device": "BK1041", // 创新医疗器械 → 医疗器械
  // 刻意不收：gpu-cloud 算力租赁 → BK1365「租赁」。租赁行业与算力租赁无关，属误配。
};

export interface Board {
  code: string;
  name: string;
  /** 2=行业板块 3=概念板块 */
  kind: number;
}

/** 去掉产业链名的通用后缀，得到可比对的关键词 */
export function normalizeChainName(name: string): string {
  return name.replace(/产业链|产业链条|产业|行业|板块/g, "").replace(/\s+/g, "").trim();
}

/**
 * 拉取全部板块（行业 t:2 + 概念 t:3）。
 *
 * 必须两类都取：只取行业板块时，「人工智能 / 白酒 / 储能 / 氢能 / 低空经济 / 创新药」
 * 这类链条全部匹配不上 —— 它们在东财被归为**概念板块**，行业列表里根本没有。
 */
export async function fetchAllBoards(): Promise<Board[]> {
  const seen = new Map<string, Board>();
  for (const kind of [2, 3]) {
    for (let pn = 1; pn <= 20; pn++) {
      const url =
        `https://push2.eastmoney.com/api/qt/clist/get?pn=${pn}&pz=100&po=1&np=1&fltt=2&invt=2` +
        `&fs=m:90+t:${kind}&fields=f12,f14`;
      const rows = await withRetry(async () => {
        const res = await fetch(url, { headers: UA, cache: "no-store", signal: AbortSignal.timeout(15000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return ((await res.json()) as any)?.data?.diff ?? [];
      });
      if (!rows.length) break;
      for (const r of rows) {
        const code = String(r.f12 ?? "");
        const name = String(r.f14 ?? "");
        if (code && name) seen.set(code, { code, name, kind });
      }
      if (rows.length < 100) break;
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  return [...seen.values()];
}

/** 上游限频是常态，退避重试；仍失败就抛给调用方按"本次不写入"处理 */
async function withRetry<T>(fn: () => Promise<T>, waits = [2000, 6000, 12000]): Promise<T> {
  let lastErr: unknown;
  for (const w of [0, ...waits]) {
    if (w) await new Promise((r) => setTimeout(r, w));
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

export interface MatchResult {
  matched: Array<{ slug: string; code: string; board: string }>;
  ambiguous: string[];
  review: string[];
  unmatched: string[];
  picked: string[];
}

/** 纯匹配：不碰数据库，便于断言与 dry-run */
export function matchChainsToBoards(
  chains: Array<{ slug: string; name: string }>,
  boards: Board[]
): MatchResult {
  const matched: MatchResult["matched"] = [];
  const ambiguous: string[] = [];
  const review: string[] = [];
  const unmatched: string[] = [];
  const picked: string[] = [];

  for (const c of chains) {
    const kw = normalizeChainName(c.name);
    if (!kw) {
      unmatched.push(`${c.slug}(${c.name}) 名称无法规范化`);
      continue;
    }

    const approved = APPROVED[c.slug];
    if (approved) {
      const hit = boards.find((b) => b.code === approved);
      if (hit) {
        matched.push({ slug: c.slug, code: hit.code, board: `${hit.name}（人工确认）` });
      } else {
        review.push(`${c.slug}(${c.name}) 人工映射 ${approved} 在当前板块列表中已不存在，需复核`);
      }
      continue;
    }

    const exact = boards.filter((b) => normalizeChainName(b.name) === kw);
    if (exact.length === 1) {
      matched.push({ slug: c.slug, code: exact[0].code, board: exact[0].name });
      continue;
    }
    if (exact.length > 1) {
      ambiguous.push(`${c.slug}(${c.name}) → ${exact.map((x) => x.name).join("/")}`);
      continue;
    }

    const forward = boards.filter((b) => normalizeChainName(b.name).includes(kw));
    if (forward.length === 1) {
      matched.push({ slug: c.slug, code: forward[0].code, board: forward[0].name });
      continue;
    }
    if (forward.length > 1) {
      /**
       * 多候选的排序规则（确定性，不是猜）：
       *   1) **行业板块优先于概念板块** —— 链→板块主要用于看行业资金流，
       *      行业分类（t:2）是标准口径；概念板块是叠加标签，同一条链常有多个。
       *   2) 其次取**最短名** —— 候选都是「链关键词 + 更细限定词」，
       *      限定越少覆盖越广，正是该链的主板块
       *      （光伏 → 光伏设备；风电 → 风电设备；军工 → 国防军工）。
       *   3) 仍平手（同名长、同类型，真正无法区分）→ 进人工确认，不猜。
       *
       * 第 1 条是实测补上的：真实数据里「光伏设备」与「光伏辅材」同为 4 字，
       * 只按长度会平手；而前者是行业板块、后者是概念板块，行业优先即可区分。
       */
      const sorted = [...forward].sort(
        (a, b) =>
          (a.kind === 2 ? 0 : 1) - (b.kind === 2 ? 0 : 1) ||
          a.name.length - b.name.length ||
          a.code.localeCompare(b.code)
      );
      const best = sorted[0];
      const tie = sorted.filter(
        (x) => (x.kind === 2) === (best.kind === 2) && x.name.length === best.name.length
      );
      if (tie.length > 1) {
        ambiguous.push(`${c.slug}(${c.name}) → 同类型同长度多候选 ${tie.map((x) => `${x.name}(${x.code})`).join("/")}`);
        continue;
      }
      matched.push({ slug: c.slug, code: best.code, board: `${best.name}（多候选：行业优先/最短名）` });
      picked.push(
        `${c.slug}(${c.name}) → ${best.name}(${best.code}, ${best.kind === 2 ? "行业" : "概念"})  其余候选：${sorted
          .slice(1)
          .map((x) => x.name)
          .join("/")}`
      );
      continue;
    }

    const reverse = boards.filter((b) => {
      const n = normalizeChainName(b.name);
      return n.length >= 2 && kw.includes(n);
    });
    if (reverse.length) {
      review.push(`${c.slug}(${c.name}) → 候选 ${reverse.map((x) => `${x.name}(${x.code})`).join("/")}`);
      continue;
    }

    unmatched.push(`${c.slug}(${c.name}) 无匹配板块`);
  }

  return { matched, ambiguous, review, unmatched, picked };
}

/**
 * 回填 industry_chains.code（幂等，可重复运行）。
 *
 * 只写入 matched，其余一律保持 NULL 并在日志里列出 ——
 * 页面对 code 为空的行为是"不展示板块入口"，这比跳到一个错误板块安全得多。
 */
export async function backfillChainSectorCodes(): Promise<{
  total: number;
  written: number;
  ambiguous: number;
  review: number;
  unmatched: number;
}> {
  await bootstrap();
  const chains = (await db
    .select({ slug: s.industryChains.slug, name: s.industryChains.name, code: s.industryChains.code })
    .from(s.industryChains)) as Array<{ slug: string; name: string; code: string | null }>;

  let boards: Board[];
  try {
    boards = await fetchAllBoards();
  } catch (e: any) {
    console.warn(`[chain-sector] 无法获取板块列表（${e?.message ?? e}），本次不做任何写入`);
    return { total: chains.length, written: 0, ambiguous: 0, review: 0, unmatched: chains.length };
  }
  if (!boards.length) {
    console.warn("[chain-sector] 板块列表为空，本次不做任何写入");
    return { total: chains.length, written: 0, ambiguous: 0, review: 0, unmatched: chains.length };
  }

  const r = matchChainsToBoards(chains, boards);

  let written = 0;
  for (const m of r.matched) {
    const cur = chains.find((c) => c.slug === m.slug);
    if (cur?.code === m.code) continue; // 已是最新，不重复写
    await db.update(s.industryChains).set({ code: m.code }).where(eq(s.industryChains.slug, m.slug));
    written++;
  }

  console.log(`[chain-sector] 板块 ${boards.length} 个，链 ${chains.length} 条`);
  console.log(`[chain-sector] 匹配 ${r.matched.length} 条（本次写入 ${written}）`);
  if (r.picked.length) {
    console.log(`[chain-sector] 多候选取最短名 ${r.picked.length} 条（留痕，便于复核）:`);
    r.picked.forEach((x) => console.log(`  ${x}`));
  }
  if (r.ambiguous.length) {
    console.log(`[chain-sector] 同长度多候选 ${r.ambiguous.length} 条（不写入）:`);
    r.ambiguous.forEach((x) => console.log(`  ${x}`));
  }
  if (r.review.length) {
    console.log(`[chain-sector] 反向候选、需人工确认 ${r.review.length} 条（不写入）:`);
    r.review.forEach((x) => console.log(`  ${x}`));
  }
  console.log(`[chain-sector] 无匹配 ${r.unmatched.length} 条（保持为空，页面不展示板块入口）`);

  return {
    total: chains.length,
    written,
    ambiguous: r.ambiguous.length,
    review: r.review.length,
    unmatched: r.unmatched.length,
  };
}