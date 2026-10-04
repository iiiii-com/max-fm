import { ALL_GLOBAL_POSITION, ALL_CYCLE } from "@/lib/data/chainCyclePosition";
import { SectionTitle, Card } from "@/components/ui";

/**
 * 全球格局与周期位置 —— 链级的前置判断。
 *
 * 与利润地图/趋势的区别：那两块回答「钱怎么赚、往哪走」，
 * 这里回答「这条链在全球分工里处于什么位置、现在处在周期哪一段」——
 * 是读者决定是否关注某条链之前的判断依据。
 *
 * 数据纪律：
 *  - 国产化率不给百分比。不同报告口径差异极大（产值/产能/装机量各不同），
 *    很多细分环节根本没有公开统计。给一个看似精确的数字比不给更危险。
 *  - 周期位置只给定性判断与判断依据，不给「还有多少空间」的推算。
 *  - invalidators（什么会推翻这个判断）比结论本身更重要，因此必须显式展示。
 */
export default function ChainPositionPanel({ slug }: { slug: string }) {
  const g = ALL_GLOBAL_POSITION[slug];
  const c = ALL_CYCLE[slug];
  if (!g && !c) return null;

  return (
    <div className="space-y-6">
      {g && (
        <>
          <SectionTitle
            title="全球格局与国产化进度"
            sub="这条链在全球分工里的位置、国产化卡在哪一层、真正的对手是谁"
          />

          <Card className="p-5">
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold text-muted mb-1.5">全球分工位置</p>
                <p className="text-sm leading-relaxed text-foreground/85">{g.globalRole}</p>
              </div>

              <div className="border-t border-border pt-4">
                <p className="text-xs font-semibold text-muted mb-1.5">
                  国产化进度
                  <span className="ml-1.5 font-normal text-muted/80">
                    （不给百分比：各报告口径差异极大，部分环节无公开统计）
                  </span>
                </p>
                <p className="text-sm leading-relaxed text-foreground/85">{g.localization}</p>
              </div>

              {g.localizationBlockers.length > 0 && (
                <div className="border-t border-border pt-4">
                  <p className="text-xs font-semibold text-muted mb-1.5">卡在哪一层</p>
                  <ul className="space-y-1">
                    {g.localizationBlockers.map((b) => (
                      <li key={b} className="flex gap-2 text-[13px] leading-relaxed text-muted">
                        <span className="text-red-500 shrink-0">·</span>
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {g.keyCompetitors.length > 0 && (
                <div className="border-t border-border pt-4">
                  <p className="text-xs font-semibold text-muted mb-1.5">真正的对手</p>
                  <div className="flex flex-wrap gap-1.5">
                    {g.keyCompetitors.map((k) => (
                      <span
                        key={k}
                        className="px-2 py-0.5 rounded text-[11px] bg-border/60 text-muted"
                      >
                        {k}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>
        </>
      )}

      {c && (
        <>
          <SectionTitle
            title="周期位置"
            sub="现在处在哪一段、凭什么这么判断、什么会推翻这个判断"
          />

          <Card className="p-5">
            <div className="mb-4 flex flex-wrap items-baseline gap-3">
              <span className="text-xs font-semibold text-muted">位置判断</span>
              <span className="text-lg font-bold text-primary">{c.stage}</span>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold text-muted mb-1.5">判断依据</p>
                <ul className="space-y-1">
                  {c.basis.map((b) => (
                    <li key={b} className="flex gap-2 text-[13px] leading-relaxed text-muted">
                      <span className="text-primary shrink-0">·</span>
                      {b}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="border-t border-border pt-4">
                <p className="text-xs font-semibold text-muted mb-1.5">方向与关键变量</p>
                <p className="text-sm leading-relaxed text-foreground/85">{c.direction}</p>
              </div>

              {c.invalidators.length > 0 && (
                <div className="border-t border-border pt-4">
                  <p className="text-xs font-semibold text-muted mb-1.5">
                    什么会推翻这个判断
                    <span className="ml-1.5 font-normal text-muted/80">
                      （可证伪条件比结论本身更重要）
                    </span>
                  </p>
                  <ul className="space-y-1">
                    {c.invalidators.map((v) => (
                      <li key={v} className="flex gap-2 text-[13px] leading-relaxed text-muted">
                        <span className="text-amber-500 shrink-0">·</span>
                        {v}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}