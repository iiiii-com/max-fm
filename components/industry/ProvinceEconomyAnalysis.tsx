import { Card, SectionTitle } from "@/components/ui";
import {
  aggregateRegions,
  concentration,
  divergence,
  mismatchGroups,
  regionCoverage,
  type ProvinceEconomyRow,
} from "@/lib/data/provinceRegions";

/**
 * 省级经济解读区块。
 *
 * /map 此前只有地图 + 城市图谱 + 城市 GDP 榜，缺一层"读地图"的结构化结论：
 * 地图告诉你「谁在哪」，但不告诉你「集中到什么程度、区域怎么分层、
 * 哪几个省在追赶、哪几个在拖累」。
 *
 * 全部数值由 /map 同一年、同一批 31 省记录现算，不引入任何新数据源。
 * 口径纪律见 lib/data/provinceRegions.ts 顶部注释 ——
 * 尤其注意：这里所有比例的分子分母同为 31 省口径，
 * 因此不展示任何「占全国 X 成」—— 那个分母站内没有。
 */
export default function ProvinceEconomyAnalysis({ rows }: { rows: ProvinceEconomyRow[] }) {
  if (!rows.length) return null;

  const coverage = regionCoverage();
  const regions = aggregateRegions(rows);
  const conc = concentration(rows);
  const div = divergence(rows);
  const { chasers, draggers, medianGdp } = mismatchGroups(rows);

  if (!coverage.ok) {
    return (
      <section>
        <SectionTitle title="区域经济解读" />
        <Card className="p-4">
          <p className="text-sm text-muted">
            区域划分数据异常：当前共 {coverage.total} 条、去重后 {coverage.unique} 条，应为 31 且无重复。
            已暂停展示区域汇总，避免给出错误的区域口径。
          </p>
        </Card>
      </section>
    );
  }

  const maxGdp = Math.max(...regions.map((r) => r.gdp), 1);
  const r1 = (v: number) => Math.round(v * 10) / 10;

  return (
    <section className="space-y-4">
      <SectionTitle
        title="区域经济解读"
        sub="按国家统计局「四大地区」口径（东部 10 / 中部 6 / 西部 12 / 东北 3）汇总。所有比例的分子分母同为本站 31 省记录，因此不含「占全国 X 成」—— 全国口径数据站内没有，不做推算"
      />
      {/* 区域分层 */}
      <Card className="p-4 md:p-5">
        <p className="text-[10px] font-bold tracking-[0.2em] text-primary mb-3">区域分层</p>
        <div className="space-y-3">
          {regions.map((rg) => (
            <div key={rg.key}>
              <div className="flex items-baseline justify-between gap-3 text-xs mb-1">
                <span className="font-medium">
                  {rg.label}
                  <span className="text-muted font-normal">（{rg.count} 省）</span>
                </span>
                <span className="font-mono text-muted">
                  GDP {rg.gdp} 万亿 · 人均 {rg.perCapitaGdp} 万
                </span>
              </div>
              <div className="h-2.5 bg-muted/20 rounded-sm overflow-hidden">
                <div
                  className="h-full bg-primary/70"
                  style={{ width: `${Math.max((rg.gdp / maxGdp) * 100, 1)}%` }}
                />
              </div>
              <p className="text-[11px] text-muted mt-1 leading-relaxed">
                均值增速 {rg.avgGrowth}%（算术均值，非加权）
                {rg.gdpShare !== null ? ` · 占 31 省合计 ${rg.gdpShare}%` : ""}
              </p>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-muted mt-3.5 leading-relaxed border-t border-border pt-2.5">
          口径说明：人均 GDP 用「区域 GDP ÷ 区域人口」重算，与各省人均 GDP 的算术平均不相等
          （后者会被小人口省份拉高）。均值为算术平均，与页面顶部概览卡口径一致；
          若需 GDP 加权增速需以上年各省 GDP 为权重，口径不同，本页不混用。
        </p>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 集中度 */}
        {conc && (
          <Card className="p-4 md:p-5">
            <p className="text-[10px] font-bold tracking-[0.2em] text-primary mb-2.5">集中度</p>
            <p className="text-3xl font-bold tabular-nums">{conc.top5Share}%</p>
            <p className="text-xs text-muted mt-1">
              前 5 省占 31 省 GDP 合计的比重（31 省合计 {conc.total} 万亿）
            </p>
            <div className="mt-3 space-y-1.5">
              {[
                { k: "前 3 名", v: conc.top3Share },
                { k: "前 5 名", v: conc.top5Share },
                { k: "前 10 名", v: conc.top10Share },
              ].map((x) => (
                <div key={x.k} className="flex items-center gap-2 text-xs">
                  <span className="text-muted w-12 shrink-0">{x.k}</span>
                  <div className="flex-1 h-1.5 bg-muted/20 rounded-sm overflow-hidden">
                    <div className="h-full bg-primary/60" style={{ width: `${x.v}%` }} />
                  </div>
                  <span className="font-mono w-14 text-right">{x.v}%</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted mt-3 leading-relaxed">
              头部：{conc.top5Names.join(" · ")}。这里的分母是 31 省合计而非全国 GDP ——
              省级加总与全国核算口径不同，两者不能直接相比。
            </p>
          </Card>
        )}

        {/* 两极分化 */}
        <Card className="p-4 md:p-5">
          <p className="text-[10px] font-bold tracking-[0.2em] text-primary mb-2.5">两极分化</p>
          <div className="space-y-2.5">
            {div.map((d) => (
              <div key={d.label} className="text-xs">
                <p className="font-medium mb-0.5">{d.label}</p>
                <div className="flex items-center gap-2">
                  <span className="up font-mono shrink-0 w-24 truncate">{d.high.name}</span>
                  <span className="font-mono w-16 text-right shrink-0">{d.high.value}</span>
                  <span className="flex-1 h-px bg-border" aria-hidden />
                  <span className="down font-mono w-16 text-left shrink-0">{d.low.value}</span>
                  <span className="text-muted shrink-0 w-24 truncate text-right">{d.low.name}</span>
                </div>
                <p className="text-[11px] text-muted mt-0.5">{d.desc}</p>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-muted mt-3 leading-relaxed border-t border-border pt-2.5">
            极差倍数反映分布的离散程度。倍数越大，说明该指标在省际间的分化越剧烈，
            用总量视角看问题会越容易失真。
          </p>
        </Card>
      </div>

      {/* 规模-增速错配 */}
      <Card className="p-4 md:p-5">
        <p className="text-[10px] font-bold tracking-[0.2em] text-primary mb-1.5">
          规模与增速的错配
        </p>
        <p className="text-xs text-muted mb-3 leading-relaxed">
          以 GDP 中位数（{medianGdp} 万亿）为界分成两组：体量小但增速高的省份是追赶力量，
          体量大但增速低的省份决定全国经济的中期走势。这两组比单看增速榜更有决策价值 ——
          增速榜里的小经济体量容易被高估其影响力。
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-medium mb-1.5 up">追赶型（GDP &lt; 中位数 · 增速居前）</p>
            <ol className="space-y-1">
              {chasers.map((r, i) => (
                <li key={r.name} className="flex items-baseline gap-2 text-xs">
                  <span className="font-mono text-muted w-4 shrink-0">{i + 1}</span>
                  <span className="flex-1 truncate">{r.name}</span>
                  <span className="font-mono text-muted">{r1(r.gdp)} 万亿</span>
                  <span className="up font-mono w-14 text-right shrink-0">+{r.growth}%</span>
                </li>
              ))}
            </ol>
          </div>
          <div>
            <p className="text-xs font-medium mb-1.5 down">拖累型（GDP ≥ 中位数 · 增速靠后）</p>
            <ol className="space-y-1">
              {draggers.map((r, i) => (
                <li key={r.name} className="flex items-baseline gap-2 text-xs">
                  <span className="font-mono text-muted w-4 shrink-0">{i + 1}</span>
                  <span className="flex-1 truncate">{r.name}</span>
                  <span className="font-mono text-muted">{r1(r.gdp)} 万亿</span>
                  <span className="font-mono w-14 text-right shrink-0">+{r.growth}%</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </Card>
    </section>
  );
}
