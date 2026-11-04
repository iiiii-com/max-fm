import { NextResponse } from "next/server";
import { toNum } from "@/lib/utils";
import { saveLastGood, loadLastGood, markStale } from "@/lib/data/last-good";
import { saveSnapshot, loadSnapshot } from "@/lib/data/snapshots";
import { EM_UT, emJson } from "@/lib/data/eastmoney";

export const dynamic = "force-dynamic";

/** 去掉层级后缀，得到归一化板块名，用于跨层级去重（与 /api/sector/board 同一口径） */
function baseName(name: string): string {
  return String(name ?? "").replace(/[ⅠⅡⅢ]$/, "");
}

/**
 * 板块榜单跨层级去重。
 *
 * 东财同时返回「白酒Ⅱ / 白酒Ⅲ」这类不同层级命名的同一板块，直接展示会出现两行数值
 * 几乎相同的记录，对比图里也会变成两根重复的条。按归一化名称只保留主力净流入绝对值
 * 最大的一个分册，再截取 Top N —— 因此上游要多取几条（pz=14）留出被去重吃掉的名额。
 */
function dedupeByBase<T extends { name: string; mainFlow: number | null }>(rows: T[], limit = 10): T[] {
  const byBase = new Map<string, T>();
  for (const row of rows) {
    const key = baseName(row.name);
    const prev = byBase.get(key);
    if (!prev || Math.abs(row.mainFlow ?? 0) > Math.abs(prev.mainFlow ?? 0)) byBase.set(key, row);
  }
  return [...byBase.values()].slice(0, limit);
}

async function fetchRank(fid: string, fs: string, po: 0 | 1, pz = 10) {
  const url =
    `https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=${pz}&po=${po}&np=1&fltt=2&invt=2` +
    `&fid=${fid}&fs=${encodeURIComponent(fs)}&fields=f12,f14,f62,f3&ut=${EM_UT}`;
  // emJson：全局限并发 + 一次重试。4 个榜单是并发发起的，
  // 直接 fetch 会撞上东财「并发连接数过高即重置连接」的行为，整块面板直接 502。
  const j = await emJson<{ data?: { diff?: any[] } }>(url, { timeoutMs: 10000, retries: 2 });
  if (!j) throw new Error("eastmoney clist unavailable");
  // 东财 clist 的数值字段类型不稳定：字段缺失时返回字符串 "-" 而不是 null。
  // 旧实现 `d.f62 ?? 0` 只挡 null/undefined，"-" 会原样透传给前端，
  // 前端 `pct.toFixed(2)` 随即抛 TypeError 崩掉整块面板；且补 0 会让
  // 「无数据」被误读成「资金流为 0」。这里统一归一化为 number | null。
  return ((j?.data?.diff ?? []) as any[]).map((d) => ({
    code: d.f12,
    name: d.f14,
    mainFlow: toNum(d.f62),
    pct: toNum(d.f3),
  }));
}

/**
 * 板块/个股主力资金流入流出排名（东财 clist f62，A股）。
 *
 * 排序方向用 `po`（1 降序 / 0 升序），**不能用 `fid=-f62`**：
 * 旧实现对流出榜传 `fid=-f62`，上游并不认这个负字段名，返回的是默认顺序的一批
 * 板块（实测「流出榜」里既有 -0.99 亿也有 +4.53 亿，完全没排序）。
 * 这不是显示细节 —— 用户以为看到的是「今日资金流出最多」，实际是一张无关的榜。
 */
export async function GET() {
  try {
    const STOCK_FS = "m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23";
    const SECTOR_FS = "m:90+t:2+f:!50";
    const [sectorInRaw, sectorOutRaw, stockIn, stockOut] = await Promise.all([
      fetchRank("f62", SECTOR_FS, 1, 14), // 板块流入 Top（降序，多取 4 条留给跨层级去重）
      fetchRank("f62", SECTOR_FS, 0, 14), // 板块流出 Top（升序 = 净流出最多在前）
      fetchRank("f62", STOCK_FS, 1), // 个股流入 Top
      fetchRank("f62", STOCK_FS, 0), // 个股流出 Top
    ]);
    const sectorIn = dedupeByBase(sectorInRaw);
    const sectorOut = dedupeByBase(sectorOutRaw);
    const payload = {
      ok: true,
      updated: new Date().toISOString(),
      dataAt: new Date().toISOString(),
      source: "东方财富资金流（push2 clist f62）",
      sectorIn, sectorOut, stockIn, stockOut,
    };
    // 成功即写一份落库快照：定时任务失败、上游抽风时页面仍能拿到「带时间戳的旧数据」。
    await saveSnapshot("market:fund-rank", payload, payload.dataAt, "资金流榜（板块/个股流入流出）");
    saveLastGood("market:fund-rank", payload);
    return NextResponse.json(payload, { headers: { "Cache-Control": "public, max-age=20, s-maxage=20" } });
  } catch (e: any) {
    // 上游（push2）失败时返回最近一次成功榜单并标记 stale；前端会提示「数据陈旧」，
    // 不让用户面对一张空白表，也不把旧数据伪装成实时数据。
    // 顺序：数据库快照（跨进程可用）→ 内存/磁盘快照 → 502。
    const snap = await loadSnapshot<any>("market:fund-rank");
    if (snap) {
      return NextResponse.json(
        { ...markStale(snap.body, snap.dataAt), dataAt: snap.dataAt },
        { status: 200, headers: { "Cache-Control": "private, max-age=5", "X-Cache": "STALE-DB" } },
      );
    }
    const last = loadLastGood<any>("market:fund-rank");
    if (last) {
      return NextResponse.json(markStale(last.body, last.at), {
        status: 200,
        headers: { "Cache-Control": "private, max-age=5", "X-Cache": "STALE" },
      });
    }
    return NextResponse.json({ ok: false, error: e?.message ?? "数据源不可用" }, { status: 502 });
  }
}