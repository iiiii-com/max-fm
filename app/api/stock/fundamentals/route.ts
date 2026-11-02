import { NextResponse } from "next/server";
import { toNum } from "@/lib/utils";
import { emJson } from "@/lib/data/eastmoney";

export const dynamic = "force-dynamic";

/** 快照缓存 60s + 单飞：产业链页一次会并行问 6~20 只标的，重复渲染不必反复打上游 */
const TTL_MS = 60_000;
const cache = new Map<string, { at: number; body: any }>();

/**
 * 个股估值/市值/价格快照（东财 push2 stock/get）。
 *
 * 稳定性背景：东财 push2 在并发稍高时会直接断开 TCP（Node 侧报
 * `TypeError: fetch failed / SocketError: other side closed (UND_ERR_SOCKET)`）。
 * 实测并发 8 个请求即 100% 失败、串行全部成功 —— 上游按并发连接数掐断。
 * 旧实现没有 try/catch，异常会冒到 Next 运行时变成 **空响应 500**：
 * 前端只看到网络错误，既拿不到原因，也无法按「数据暂不可用」降级展示。
 * 现在统一走 `emJson`（全局限并发 2 + 一次重试）兜底为结构化 502 + 8s 超时，
 * 并补齐 changePct（f3）字段
 * （调用方 ChainQuotes 一直在读 data.changePct，旧实现根本没返回过 → 涨跌幅永远为空）。
 */
export async function GET(req: Request) {
  const secid = new URL(req.url).searchParams.get("secid") || "";
  if (!/^[01]\.\d{6}$/.test(secid)) {
    return NextResponse.json({ ok: false, error: "invalid secid" }, { status: 400 });
  }
  const hit = cache.get(secid);
  if (hit && Date.now() - hit.at < TTL_MS) {
    // 命中进程缓存也带上 CDN 缓存头：线上请求常落在新冷实例，进程缓存不共享，
    // 真正跨用户复用的是边缘节点（s-maxage）。
    return NextResponse.json(hit.body, {
      headers: {
        "X-Cache": "HIT",
        "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=120",
      },
    });
  }
  const fields = "f57,f58,f43,f3,f116,f117,f162,f167,f92,f168,f164,f60";
  const url = `https://push2.eastmoney.com/api/qt/stock/get?secid=${secid}&fields=${fields}&fltt=2&invt=2`;
  try {
    const json = await emJson<{ data?: Record<string, any> }>(url, { timeoutMs: 8000 });
    if (!json) {
      return NextResponse.json({ ok: false, error: "上游接口不可用" }, { status: 502 });
    }
    const d = json?.data;
    if (!d) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
    const body = {
      ok: true,
      data: {
        name: d.f58,
        code: d.f57,
        // 东财数值字段类型不稳定（number / 数字字符串 / "-"），统一归一化为 number|null，
        // 避免各调用方各自 `v.toFixed()` 时踩到字符串抛 TypeError
        price: toNum(d.f43),
        changePct: toNum(d.f3),
        totalMv: toNum(d.f116),
        floatMv: toNum(d.f117),
        pe: toNum(d.f162),
        pb: toNum(d.f167),
        bps: toNum(d.f92),
        eps: toNum(d.f164),
        turnover: toNum(d.f168),
        prevClose: toNum(d.f60),
      },
    };
    cache.set(secid, { at: Date.now(), body });
    return NextResponse.json(body, {
      headers: { "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=120" },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "上游接口不可用" }, { status: 502 });
  }
}