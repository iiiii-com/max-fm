import { NextResponse } from "next/server";
import { fetchEtfBoard, fetchEtfQuote } from "@/lib/data/market";

export const dynamic = "force-dynamic";

function secidOf(code: string): string {
  return `${code.startsWith("5") ? "1" : "0"}.${code}`;
}

/**
 * 按代码批量解析 ETF 标的（供 /compare?codes=... 这类跨页深链使用）。
 * 先查实时榜单（一次请求覆盖活跃 ETF），榜单未覆盖的再逐只查行情补齐；
 * 同一代码不重复请求，最多 8 只 —— 与对比中心的上限一致。
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const raw = (url.searchParams.get("codes") || "").trim();
  const codes = Array.from(
    new Set(
      raw
        .split(",")
        .map((c) => c.trim())
        .filter((c) => /^\d{6}$/.test(c))
    )
  ).slice(0, 8);
  if (!codes.length) {
    return NextResponse.json({ ok: false, error: "codes 参数不合法（需 6 位代码，逗号分隔）" }, { status: 400 });
  }
  try {
    const board = (await fetchEtfBoard().catch(() => null)) ?? [];
    const byCode = new Map(board.map((b) => [b.code, b]));
    const items = await Promise.all(
      codes.map(async (code) => {
        const hit = byCode.get(code);
        if (hit) return { code, name: hit.name, secid: hit.secid };
        const q = await fetchEtfQuote(secidOf(code)).catch(() => null);
        if (q?.name) return { code, name: q.name, secid: secidOf(code) };
        return null;
      })
    );
    const found = items.filter((x): x is { code: string; name: string; secid: string } => Boolean(x));
    return NextResponse.json(
      { ok: true, items: found, missing: codes.filter((c) => !found.some((f) => f.code === c)) },
      { headers: { "Cache-Control": "public, max-age=60" } }
    );
  } catch {
    return NextResponse.json({ ok: false, error: "ETF 代码解析暂不可用" }, { status: 502 });
  }
}
