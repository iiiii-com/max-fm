"use client";

import { CHAIN_ECONOMICS } from "@/lib/data/chainEconomics";
import { CHAIN_CAREERS } from "@/lib/data/chainCareers";
import { SectionTitle, Card, Badge } from "@/components/ui";

/**
 * 产业链深度解读面板：利润地图、成本传导、趋势、职业与岗位。
 *
 * 与 ChainInsightPanel 的分工：
 *  - ChainInsightPanel 回答「这条链怎么赚钱、风险在哪、怎么看」（投资视角）
 *  - 本面板回答「利润落在哪一段、接下来往哪走、什么人在这条链上工作」（产业与从业者视角）
 *
 * 薪资口径：站内没有分职业薪资数据，本面板只给"链内相对位置"与
 * "决定薪资的变量"，不写任何金额。原因与官方口径见 chainCareers.ts 头部注释。
 */
export default function ChainDeepDivePanel({ slug }: { slug: string }) {
  const econ = CHAIN_ECONOMICS[slug];
  const career = CHAIN_CAREERS[slug];
  if (!econ && !career) return null;

  return (
    <div className="space-y-6">
      {econ && (
        <>
          <SectionTitle
            title="利润地图"
            sub="这条链的钱赚在哪一段、成本压力落在谁身上"
          />

          <div className="grid grid-cols-1 gap-3">
            <Card className="p-5 border-l-4 border-l-amber-500/70">
              <p className="text-xs font-semibold text-muted mb-2">💰 利润落在哪一段</p>
              <p className="text-sm leading-relaxed text-foreground/85">{econ.profitMap}</p>
            </Card>

            <Card className="p-5 border-l-4 border-l-sky-500/70">
              <p className="text-xs font-semibold text-muted mb-2">🔁 成本压力与议价</p>
              <p className="text-sm leading-relaxed text-foreground/85">{econ.costPassThrough}</p>
            </Card>
          </div>

          <SectionTitle title="发展趋势" sub="未来两三年最确定的方向，以及它的推力与阻力" />

          <Card className="p-5">
            <p className="text-sm leading-relaxed text-foreground/85 mb-4">{econ.trend}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-2">
                  ↑ 驱动力
                </p>
                <ul className="space-y-1.5">
                  {econ.drivers.map((d) => (
                    <li key={d} className="flex gap-2 text-[13px] text-muted leading-relaxed">
                      <span className="text-emerald-500 shrink-0">·</span>
                      {d}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold text-red-600 dark:text-red-400 mb-2">
                  ↓ 制约
                </p>
                <ul className="space-y-1.5">
                  {econ.constraints.map((c) => (
                    <li key={c} className="flex gap-2 text-[13px] text-muted leading-relaxed">
                      <span className="text-red-500 shrink-0">·</span>
                      {c}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>
        </>
      )}

      {career && (
        <>
          <SectionTitle
            title="职业与岗位"
            sub="这条链招什么人、每个岗位实际在做什么、门槛与链内薪资位置"
          />

          <Card className="p-5 mb-3">
            <p className="text-xs font-semibold text-muted mb-2">👥 用人结构</p>
            <p className="text-sm leading-relaxed text-foreground/85">{career.hiring}</p>
          </Card>

          <Card className="p-5 mb-3 border-l-4 border-l-primary/60">
            <p className="text-xs font-semibold text-muted mb-2">
              📊 决定这条链薪资差距的变量
            </p>
            <ol className="space-y-1.5">
              {career.payDrivers.map((d, i) => (
                <li key={d} className="flex gap-2 text-[13px] text-muted leading-relaxed">
                  <span className="text-primary font-mono shrink-0">{i + 1}</span>
                  {d}
                </li>
              ))}
            </ol>
            <p className="mt-3 pt-3 border-t border-border text-[11px] text-muted/80 leading-relaxed">
              站内不提供分职业薪资数值：官方《城镇单位就业人员平均工资》只到
              「行业门类」粒度，无法对应到具体产业链或岗位，且不含个体与灵活就业。
              这里给的是链内相对位置与决定变量 —— 把上面几条套到具体岗位上，
              比记一个会被时间淘汰的数字更有用。
            </p>
          </Card>

          <div className="space-y-3">
            {career.roles.map((r) => (
              <Card key={r.title} className="p-5">
                <div className="flex items-start gap-3 mb-2">
                  <h4 className="font-bold text-sm">{r.title}</h4>
                  {r.pay && <Badge tone="blue">{r.pay.split(/[，。；]/)[0]}</Badge>}
                </div>

                <div className="space-y-2.5 text-[13px] leading-relaxed">
                  <div>
                    <span className="text-xs font-semibold text-muted">工作内容 · </span>
                    <span className="text-foreground/85">{r.work}</span>
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-muted">门槛 · </span>
                    <span className="text-muted">{r.threshold}</span>
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-muted">薪资位置 · </span>
                    <span className="text-muted">{r.pay}</span>
                  </div>
                  {r.path && (
                    <div>
                      <span className="text-xs font-semibold text-muted">出路 · </span>
                      <span className="text-muted">{r.path}</span>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}