import Link from "next/link";
import { Badge, Card, SectionTitle } from "@/components/ui";
import { getChainEtfRows } from "@/lib/data/chain-etfs";

const PROSPERITY_TONE: Record<string, "red" | "amber" | "blue" | "gray"> = {
  高景气: "red",
  中景气: "amber",
  分化: "blue",
  低景气: "gray",
};

/**
 * 产业地图总览：主线产业链 × ETF 实时对照。
 *
 * 产业地图原来只有链内部结构，用户看完「这条链很好」却找不到可交易的表达。
 * 这张表把每条链的主 ETF 与链内 ETF 等权涨跌放到同一个屏幕上，
 * 一眼就能看出「结构判断」与「市场定价」是否一致。
 */
export default async function ChainEtfBoard({
  chains,
}: {
  chains: Array<{ slug: string; name: string; prosperity?: string }>;
}) {
  const rows = await getChainEtfRows(chains.map((c) => ({ slug: c.slug, name: c.name })));
  const prosperityOf = new Map(chains.map((c) => [c.slug, c.prosperity]));
  const covered = rows.filter((r) => r.primary);
  const sorted = [...covered].sort((a, b) => {
    if (a.avgPct == null && b.avgPct == null) return 0;
    if (a.avgPct == null) return 1;
    if (b.avgPct == null) return -1;
    return b.avgPct - a.avgPct;
  });
  const upCount = sorted.filter((r) => (r.avgPct ?? 0) > 0).length;
  const downCount = sorted.filter((r) => (r.avgPct ?? 0) < 0).length;

  return (
    <section>
      <SectionTitle
        title="主线产业链 × ETF 实时对照"
        sub="每条链对应的场内可交易表达：主 ETF 为人工精选，链内 ETF 等权涨跌用于对照市场定价；按等权涨跌降序排列，点链名进链详情，点 ETF 直达 ETF 专区"
      />
      <Card className="p-0 overflow-hidden">
        <div className="flex items-center gap-3 flex-wrap px-4 py-2.5 border-b border-border text-[11px] text-muted">
          <span>
            {covered.length} / {rows.length} 条链已有 ETF 映射
          </span>
          <span className="up">上涨 {upCount}</span>
          <span className="down">下跌 {downCount}</span>
          <span className="ml-auto">
            想横向比较？点右侧 ETF 进详情，或在
            <Link href="/compare" className="mx-1 text-primary hover:underline">对比中心</Link>
            混选多只 ETF
          </span>
        </div>
        <div className="max-h-[560px] overflow-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10 bg-surface">
              <tr className="text-muted text-[11px]">
                <th className="text-left font-medium px-4 py-2">产业链</th>
                <th className="text-left font-medium px-2 py-2">景气</th>
                <th className="text-left font-medium px-2 py-2">主 ETF</th>
                <th className="text-right font-medium px-2 py-2">最新价</th>
                <th className="text-right font-medium px-2 py-2">ETF 涨跌</th>
                <th className="text-right font-medium px-2 py-2">链内等权</th>
                <th className="text-right font-medium px-4 py-2">覆盖</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => {
                const p = row.primary!;
                const pct = row.avgPct;
                const primaryPct = p.changePct;
                return (
                  <tr key={row.slug} className="border-t border-border/60 hover:bg-primary/5">
                    <td className="px-4 py-2">
                      <Link href={`/industry/${row.slug}`} className="text-primary hover:underline">
                        {row.name}
                      </Link>
                    </td>
                    <td className="px-2 py-2">
                      {prosperityOf.get(row.slug) ? (
                        <Badge tone={PROSPERITY_TONE[prosperityOf.get(row.slug)!] ?? "gray"}>
                          {prosperityOf.get(row.slug)}
                        </Badge>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      <Link
                        href={`/market?tab=etf&secid=${p.secid}&name=${encodeURIComponent(p.name)}`}
                        className="hover:text-primary hover:underline"
                      >
                        {p.name}
                        <span className="text-[10px] text-muted ml-1 font-mono">{p.code}</span>
                      </Link>
                      <span className="text-[10px] text-muted ml-1">{p.source === "名称匹配" ? "· 名称匹配" : ""}</span>
                    </td>
                    <td className="px-2 py-2 text-right font-mono tabular-nums">
                      {p.price == null ? "—" : p.price.toFixed(3)}
                    </td>
                    <td
                      className={`px-2 py-2 text-right font-mono tabular-nums ${
                        primaryPct == null ? "text-muted" : primaryPct >= 0 ? "up" : "down"
                      }`}
                    >
                      {primaryPct == null ? "—" : `${primaryPct >= 0 ? "+" : ""}${primaryPct.toFixed(2)}%`}
                    </td>
                    <td
                      className={`px-2 py-2 text-right font-mono tabular-nums ${
                        pct == null ? "text-muted" : pct >= 0 ? "up" : "down"
                      }`}
                    >
                      {pct == null ? "—" : `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`}
                    </td>
                    <td className="px-4 py-2 text-right text-muted tabular-nums">
                      {row.items.length} 只
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="px-4 py-2.5 border-t border-border text-[11px] text-muted leading-relaxed">
          口径：主 ETF / 链内 ETF 为人工精选映射（按跟踪指数与链成分重合度），行情来自东财 ETF 板块实时榜单，20 秒缓存；
          链内等权 = 该链映射 ETF 的涨跌幅简单平均，不是链指数（链指数见各链详情页）。
          没有映射的链不出现在表内，名称匹配为兜底结果，会标注来源。
        </p>
      </Card>
    </section>
  );
}
