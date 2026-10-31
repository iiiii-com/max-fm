import { NextResponse } from "next/server";
import { bootstrap } from "@/lib/db";
import { getChains } from "@/lib/data/queries";
import { chainHitsByEtfName, chainSlugsForEtf } from "@/lib/data/chain-etfs";

export const dynamic = "force-dynamic";

/**
 * ETF → 产业链 反查。
 * 先查人工映射（code 精确命中），再用 ETF 名称的强特征词匹配链关键词兜底；
 * basis 字段让前端能区分「映射」与「名称匹配」，避免把关键词匹配当成结论。
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = (url.searchParams.get("code") || "").trim();
  const name = (url.searchParams.get("name") || "").trim();
  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json({ ok: false, error: "code 参数不合法" }, { status: 400 });
  }
  try {
    await bootstrap();
    const chainRows = (await getChains()) as Array<{ slug: string; name: string }>;
    const bySlug = new Map(chainRows.map((c) => [c.slug, c.name]));
    const mapped = chainSlugsForEtf(code)
      .map((slug) => ({ slug, name: bySlug.get(slug) ?? slug, basis: "映射" as const }))
      .filter((c) => bySlug.has(c.slug));
    const seen = new Set(mapped.map((m) => m.slug));
    const matched = chainHitsByEtfName(name, chainRows)
      .filter((h) => !seen.has(h.slug))
      .map((h) => ({ ...h, basis: "名称匹配" as const }));
    return NextResponse.json(
      { ok: true, chains: [...mapped, ...matched].slice(0, 6) },
      { headers: { "Cache-Control": "public, max-age=60" } }
    );
  } catch {
    return NextResponse.json({ ok: false, error: "产业链映射暂不可用" }, { status: 502 });
  }
}
