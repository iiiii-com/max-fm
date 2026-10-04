import Link from "next/link";
import { ALL_CHAIN_CITIES, ALL_PROS_CONS } from "@/lib/data/chainCityProsAll";
import { SectionTitle, Card } from "@/components/ui";

/**
 * 代表城市与产业优劣势。
 *
 * 为什么这两个维度放在同一面板：
 *  - 代表城市回答「这条链在哪里」，是结构落到地理上的那一步 ——
 *    找工作、找合作方、判断某地产业机会都需要这层映射。
 *  - 优劣势回答「这条链值不值得进」，其中 fitFor / notFor 比抽象的
 *    优缺点更可操作：结构性优缺点是描述，适合谁是判断。
 *
 * 城市链接指向站内 /map 的城市详情 —— 城市名已在校验脚本里核对过
 * 必须存在于 lib/data/regions，因此不会产生死链。
 */
export default function ChainCityProsPanel({ slug }: { slug: string }) {
  const cities = ALL_CHAIN_CITIES[slug] ?? [];
  const pc = ALL_PROS_CONS[slug];
  if (!cities.length && !pc) return null;

  return (
    <div className="space-y-6">
      {cities.length > 0 && (
        <>
          <SectionTitle
            title="代表城市"
            sub="这条链真正集聚在哪几个城市、每个城市集聚什么环节。点击城市查看该市的产业与经济解读"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {cities.map((c) => (
              <Card key={c.city} className="p-4">
                <Link
                  href={`/map?city=${encodeURIComponent(c.city)}`}
                  className="text-sm font-bold hover:text-primary transition-colors"
                >
                  {c.city}
                  <span className="ml-1 text-[10px] font-normal text-muted">城市解读 →</span>
                </Link>
                <p className="mt-1.5 text-[12px] font-medium text-primary/90">{c.focus}</p>
                <p className="mt-1 text-[12px] leading-relaxed text-muted">{c.why}</p>
              </Card>
            ))}
          </div>
        </>
      )}

      {pc && (
        <>
          <SectionTitle
            title="优势与短板"
            sub="结构性特征（长期成立），以及什么人进入这条链更容易做成"
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Card className="p-5 border-l-4 border-emerald-500/60">
              <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-2">
                ✓ 结构性优势
              </p>
              <ul className="space-y-1.5">
                {pc.strengths.map((s) => (
                  <li key={s} className="flex gap-2 text-[13px] leading-relaxed text-foreground/85">
                    <span className="text-emerald-500 shrink-0">·</span>
                    {s}
                  </li>
                ))}
              </ul>
            </Card>

            <Card className="p-5 border-l-4 border-red-500/60">
              <p className="text-xs font-semibold text-red-600 dark:text-red-400 mb-2">
                ✗ 结构性短板
              </p>
              <ul className="space-y-1.5">
                {pc.weaknesses.map((w) => (
                  <li key={w} className="flex gap-2 text-[13px] leading-relaxed text-foreground/85">
                    <span className="text-red-500 shrink-0">·</span>
                    {w}
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <Card className="p-5">
            <p className="text-xs font-semibold text-muted mb-3">
              谁更适合进入这条链
              <span className="ml-1.5 font-normal text-muted/80">
                （结构性优缺点是描述，这一栏是判断）
              </span>
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 mb-1.5">
                  适合
                </p>
                <ul className="space-y-1">
                  {pc.fitFor.map((f) => (
                    <li key={f} className="flex gap-2 text-[13px] leading-relaxed text-muted">
                      <span className="text-emerald-500 shrink-0">·</span>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-red-600 dark:text-red-400 mb-1.5">
                  不适合
                </p>
                <ul className="space-y-1">
                  {pc.notFor.map((f) => (
                    <li key={f} className="flex gap-2 text-[13px] leading-relaxed text-muted">
                      <span className="text-red-500 shrink-0">·</span>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}