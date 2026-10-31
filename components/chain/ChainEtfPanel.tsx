import Link from "next/link";
import { Badge, Card, SectionTitle } from "@/components/ui";
import { getChainEtfOverview } from "@/lib/data/chain-etfs";

function fmtAmt(v: number | null): string {
  if (v == null) return "—";
  if (v >= 1e8) return `${(v / 1e8).toFixed(2)} 亿`;
  if (v >= 1e4) return `${(v / 1e4).toFixed(0)} 万`;
  return `${v.toFixed(0)}`;
}

/**
 * 产业链 ↔ ETF 互通面板（服务端组件）。
 *
 * 用户要解决的原始问题：产业地图里看到主线产业链，却没法直接看到对应的 ETF，
 * 也没法把链的判断落到可交易的表达上。这里做三件事：
 * 1. 给出这条链的「可交易表达」：精选映射的 ETF + 实时行情；
 * 2. 允许把多只 ETF 一次性送进对比中心（同窗口归一化比较）；
 * 3. 说明口径：哪些是人工映射、哪些是名称匹配，行情来源与缓存。
 */
export default async function ChainEtfPanel({ slug, chainName }: { slug: string; chainName: string }) {
  const data = await getChainEtfOverview(slug);
  const tradeable = data.items.filter((i) => i.price != null);
  const compareCodes = tradeable.slice(0, 6).map((i) => i.code).join(",");
  const mapped = data.items.filter((i) => i.source === "映射");
  const matched = data.items.filter((i) => i.source === "名称匹配");

  return (
    <section>
      <SectionTitle
        title="产业链 × ETF 互通"
        sub="把链的判断落到可交易的场内 ETF：映射为人工精选（按跟踪指数与链的成分重合度），名称匹配为全市场名称筛选；行情为实时报价，20 秒缓存，点击可直达 ETF 专区看 K 线与净值"
      />
      {data.items.length ? (
        <>
          <div className="flex items-center gap-3 flex-wrap mb-3">
            <Badge tone={data.avgPct == null ? "gray" : data.avgPct >= 0 ? "red" : "green"}>
              链内 ETF 等权 {data.avgPct == null ? "—" : `${data.avgPct >= 0 ? "+" : ""}${data.avgPct.toFixed(2)}%`}
            </Badge>
            <span className="text-[11px] text-muted">
              上涨 {data.up} · 下跌 {data.down} · 平盘 {data.flat}
            </span>
            {compareCodes.includes(",") && (
              <Link
                href={`/compare?codes=${compareCodes}`}
                className="text-xs text-primary hover:underline ml-auto"
              >
                多只 ETF 同窗口对比 →
              </Link>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
            {data.items.map((item) => {
              const isUp = (item.changePct ?? 0) > 0;
              const isDown = (item.changePct ?? 0) < 0;
              return (
                <Card key={`${item.code}-${item.source}`} className="p-3 flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-medium truncate">{item.name}</span>
                        <span className="text-[10px] text-muted tabular-nums shrink-0">{item.code}</span>
                        <Badge tone={item.source === "映射" ? "gray" : "amber"}>{item.source}</Badge>
                        <Badge tone="gray">{item.cat}</Badge>
                      </div>
                      <p className="text-[11px] text-muted mt-1 leading-relaxed line-clamp-2">{item.why}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold tabular-nums">
                        {item.price == null ? "—" : item.price.toFixed(3)}
                      </p>
                      <p className={`text-[11px] tabular-nums ${isUp ? "up" : isDown ? "down" : "text-muted"}`}>
                        {item.changePct == null
                          ? "行情暂缺"
                          : `${item.changePct >= 0 ? "+" : ""}${item.changePct.toFixed(2)}%`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-[11px] text-muted">
                    <span className="tabular-nums">
                      成交额 {item.amount == null ? "—" : fmtAmt(item.amount)}
                      {item.turnover != null ? ` · 换手 ${item.turnover.toFixed(2)}%` : ""}
                    </span>
                    <Link
                      href={`/market?tab=etf&secid=${item.secid}&name=${encodeURIComponent(item.name)}`}
                      className="text-primary hover:underline shrink-0"
                    >
                      看 K 线 →
                    </Link>
                  </div>
                </Card>
              );
            })}
          </div>

          <p className="mt-2 text-[11px] text-muted leading-relaxed">
            {data.note}
            {mapped.length && matched.length
              ? ` 其中 ${mapped.length} 只为人工映射、${matched.length} 只来自名称匹配。`
              : ""}
            {` 关键词筛选只能表达「名字像」，不能替代指数成分核对；${chainName}的实际利润分布请看上方链指数与环节拆解。`}
          </p>
        </>
      ) : (
        <Card className="p-4">
          <p className="text-xs text-muted leading-relaxed">
            这条链暂无可稳定对应的场内 ETF（主题过窄或尚无跟踪产品）。
            可以在
            <Link href="/market?tab=etf" className="mx-1 text-primary hover:underline">ETF 专区</Link>
            用名称关键词自行筛选，或参考链内代表公司的个股行情。
          </p>
        </Card>
      )}
    </section>
  );
}
