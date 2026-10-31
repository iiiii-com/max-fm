import { NextResponse } from "next/server";
import { toNum } from "@/lib/utils";
import { EM_UT, emJson } from "@/lib/data/eastmoney";
import { saveLastGood, loadLastGood, markStale } from "@/lib/data/last-good";
import { saveSnapshot, loadSnapshot } from "@/lib/data/snapshots";

/**
 * 东财行情列表通用请求（涨跌幅/资金/成交额榜）。
 *
 * 稳定性（P1）：旧实现单条请求失败就整张异动榜 502，页面「市场异动」直接空白。
 * 根因实测（2026-10-29，本机直连 push2）：**并发 8 个请求即 100% 失败**
 * （UND_ERR_SOCKET: other side closed），串行则全部成功 —— 上游按并发连接数掐断。
 * 因此修复不是"多试一次"这么表面：统一改走 `emJson`（全局限并发 2 + 一次重试），
 * 并在最终失败时降级为空数组，让其余榜单仍能渲染（部分数据好过整块不可用）。
 * 同时补 ut 参数：缺失时东财对部分字段返回 "-"（同 fund-rank 的 P0）。
 */
async function fetchList(fid: string, fields: string, pz = 12): Promise<any[]> {
  const fs = encodeURIComponent("m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23");
  const url =
    `https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=${pz}&po=1&np=1&fltt=2&invt=2&fid=${fid}&fs=${fs}&fields=${fields}&ut=${EM_UT}`;
  const j = await emJson<{ data?: { diff?: any[] } }>(url, { timeoutMs: 8000, retries: 1 });
  if (!j) {
    console.warn(`[market/surge] fetchList(${fid}) 降级为空榜（上游不可用或重试后仍失败）`);
    return [];
  }
  return j?.data?.diff ?? [];
}

/** 异动分档：把涨停榜/涨幅榜/异动榜/跌幅榜合并后的列表按档位归类 */
export type SurgeBucket = "limit-up" | "big-up" | "watch" | "big-down" | "limit-down";

/**
 * 异动原因判定。
 *
 * 旧实现把不同来源的榜单（涨停 / 涨幅 / 异动 / 跌幅）直接拼在一起返回，
 * 排序完全不连续（实测出现 9.27 → 9.99 → 10.01 → 4.16 → 9.8），
 * 界面上看起来像排序坏了。现在给出明确档位 + 档内排序依据。
 * 同时对「既没涨跌幅越界也没资金异动」的情况给出具体说明，而不是笼统的「异动观察」。
 */
function classify(item: any): { bucket: SurgeBucket; reason: string } {
  // 同 fund-rank：东财数值字段可能是字符串 "-"，先归一化再比较，
  // 否则 "-" >= 9.5 为 false、`涨跌幅 -%` 这类文案会漏进 UI。
  const pct = toNum(item.f3);
  const flow = toNum(item.f62);
  const turnover = toNum(item.f6);
  const tags: string[] = [];

  let bucket: SurgeBucket = "watch";
  if (pct != null) {
    if (pct >= 9.5) {
      bucket = "limit-up";
      tags.push("涨停/大涨");
    } else if (pct >= 5) {
      bucket = "big-up";
      tags.push("大幅上涨");
    } else if (pct <= -9.5) {
      bucket = "limit-down";
      tags.push("跌停/大跌");
    } else if (pct <= -5) {
      bucket = "big-down";
      tags.push("大幅下跌");
    }
  }
  if (flow != null) {
    if (flow > 5e8) tags.push("主力抢筹");
    else if (flow < -5e8) tags.push("主力出逃");
  }
  // 无越界信号时说明它到底是被哪一项选进来的
  if (!tags.length) {
    if (pct != null) tags.push(`涨跌幅 ${pct >= 0 ? "+" : ""}${pct}%`);
    else if (turnover != null) tags.push("成交额居前");
    else tags.push("入选异动榜");
  }
  return { bucket, reason: tags.join(" · ") };
}

const BUCKET_ORDER: SurgeBucket[] = ["limit-up", "big-up", "watch", "big-down", "limit-down"];

function marketOf(code: string): string {
  // 注意顺序：科创板 68x / 创业板 30x 都以 6、3 开头，必须先判
  if (code.startsWith("68")) return "科创板";
  if (code.startsWith("30")) return "创业板";
  if (code.startsWith("6") || code.startsWith("9")) return "沪";
  if (code.startsWith("0")) return "深";
  if (code.startsWith("3")) return "深";
  return "A股";
}

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [gainer, flow, turnover] = await Promise.all([
      fetchList("f3", "f12,f14,f2,f3,f62"),
      fetchList("f62", "f12,f14,f2,f3,f62"),
      fetchList("f6", "f12,f14,f2,f3,f6"),
    ]);

    // 合并去重：涨幅榜前 8 + 资金榜前 6 + 成交额榜前 6
    const merged = new Map<string, any>();
    const push = (arr: any[], limit: number) =>
      (arr ?? []).slice(0, limit).forEach((it: any) => {
        if (it?.f12 && !merged.has(it.f12)) merged.set(it.f12, it);
      });
    push(gainer, 8);
    push(flow, 6);
    push(turnover, 6);

    // 归入明确档位并做**档内排序**，使整体顺序连续（涨停 → 大涨 → 异动 → 大跌 → 跌停）
    const ranked = [...merged.values()]
      .map((it: any) => {
        const c = classify(it);
        return {
          code: it.f12,
          name: it.f14,
          market: marketOf(it.f12),
          price: toNum(it.f2),
          pct: toNum(it.f3),
          mainFlow: toNum(it.f62),
          turnover: toNum(it.f6),
          reason: c.reason,
          bucket: c.bucket,
        };
      })
      .sort((a, b) => {
        const ba = BUCKET_ORDER.indexOf(a.bucket);
        const bb = BUCKET_ORDER.indexOf(b.bucket);
        if (ba !== bb) return ba - bb;
        // 同档内按涨跌幅绝对值从大到小
        return Math.abs(Number(b.pct ?? 0)) - Math.abs(Number(a.pct ?? 0));
      });
    const surges = ranked;

    // 行业板块热点（涨幅前 8）；单独容错，失败不影响个股异动榜
    let sectors: any[] = [];
    try {
      const sectorRes = await fetch(
        `https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=8&po=1&np=1&fltt=2&invt=2&fid=f3&fs=${encodeURIComponent("m:90+t:2+f:!50")}&fields=f12,f14,f3,f104,f105,f106&ut=${EM_UT}`,
        {
          headers: { "User-Agent": "Mozilla/5.0", Referer: "https://quote.eastmoney.com/" },
          cache: "no-store",
          signal: AbortSignal.timeout(8000),
        }
      );
      if (sectorRes.ok) {
        const sectorJ = await sectorRes.json();
        sectors = ((sectorJ?.data?.diff ?? []) as any[]).map((s) => ({
          code: s.f12,
          name: s.f14,
          pct: toNum(s.f3),
          up: toNum(s.f104) ?? 0,
          down: toNum(s.f105) ?? 0,
          flat: toNum(s.f106) ?? 0,
        }));
      }
    } catch (e: any) {
      console.warn("[market/surge] 板块热点获取失败:", e?.message);
    }

    // 三张个股榜全失败才判定整块不可用；只要有一张有数据就返回部分结果，
    // 响应里带 degraded 让前端可以提示「部分榜单暂不可用」而不是假装数据完整。
    if (!surges.length && !sectors.length) {
      // 整块上游都空 → 先取落库快照（跨进程/跨重启可用），再退回内存+磁盘快照，并标记 stale
      const snap = await loadSnapshot<any>("market:surge");
      if (snap) {
        return NextResponse.json(
          { ...markStale(snap.body, snap.dataAt), dataAt: snap.dataAt },
          { status: 200, headers: { "Cache-Control": "private, max-age=5", "X-Cache": "STALE-DB" } },
        );
      }
      const last = loadLastGood<any>("market:surge");
      if (last) {
        return NextResponse.json(markStale(last.body, last.at), {
          status: 200,
          headers: { "Cache-Control": "private, max-age=5", "X-Cache": "STALE" },
        });
      }
      return NextResponse.json({ ok: false, error: "行情数据源暂不可用，请稍后重试" }, { status: 502 });
    }

    const payload = {
      ok: true,
      degraded: surges.length === 0,
      updated: new Date().toISOString(),
      dataAt: new Date().toISOString(),
      source: "东方财富实时行情（push2.eastmoney.com）",
      surges,
      sectors,
    };
    // 成功即写落库快照：定时预取（task=market-prefetch）也会刷新它，
    // 上游抽风时前端能拿到「带时间戳的旧数据」而不是空白面板。
    await saveSnapshot("market:surge", payload, payload.dataAt, "异动榜（个股/板块）");
    saveLastGood("market:surge", payload);
    return NextResponse.json(payload);
  } catch (e: any) {
    const snap = await loadSnapshot<any>("market:surge");
    if (snap) {
      return NextResponse.json(
        { ...markStale(snap.body, snap.dataAt), dataAt: snap.dataAt },
        { status: 200, headers: { "Cache-Control": "private, max-age=5", "X-Cache": "STALE-DB" } },
      );
    }
    const last = loadLastGood<any>("market:surge");
    if (last) {
      return NextResponse.json(markStale(last.body, last.at), {
        status: 200,
        headers: { "Cache-Control": "private, max-age=5", "X-Cache": "STALE" },
      });
    }
    return NextResponse.json({ ok: false, error: e?.message ?? "数据源不可用" }, { status: 502 });
  }
}
