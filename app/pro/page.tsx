import Link from "next/link";
import { ArrowLeft, Check, Lock } from "lucide-react";
import { Card } from "@/components/ui";
import { getSession } from "@/lib/auth";
import { isPro, PLAN_LABEL, proFeaturesByGroup, PRO_FEATURES } from "@/lib/plan";
import SectorRankTable from "@/components/pro/SectorRankTable";
import ExportButtons from "@/components/pro/ExportButtons";
import PolicyDeepList from "@/components/pro/PolicyDeepList";

export const dynamic = "force-dynamic";
export const metadata = { title: "专业版工作台 | Max 财经" };

/**
 * 专业版中心：按「你在解决什么问题」分区，而不是按实现模块堆一列。
 *
 * 四个分区对应研究流程的四个动作：读懂（深度解读）→ 配比（组合风控）
 * → 横比（批量计算）→ 留档（研究留档）。同一分区里的能力可以对着用。
 *
 * 每条能力都标真实状态：能点的直接给入口，不能点的写「规划中」。
 * 列一个点不开的名字比不列更伤信任。
 */
export default async function ProPage() {
  const session = await getSession();
  const pro = isPro(session);
  const groups = proFeaturesByGroup();

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 space-y-8">
      <header>
        <div className="flex items-center gap-2 text-xs text-muted mb-3">
          <Link href="/" className="hover:text-primary">首页</Link>
          <span>/</span>
          <span className="text-foreground font-medium">专业版工作台</span>
        </div>
        <h1 className="font-black text-2xl sm:text-3xl tracking-tight mb-3">专业版工作台</h1>
        <p className="text-sm text-muted leading-relaxed max-w-3xl">
          按研究流程分四个区：<b className="text-foreground">深度解读</b> 读懂政策、
          <b className="text-foreground">组合风控</b> 定配比、
          <b className="text-foreground">批量计算</b> 做横向比较、
          <b className="text-foreground">研究留档</b> 把结论连同口径导出。
          每个区的能力可以对着用 —— 解读给的传导路径、风控给的权重、排行给的强弱，
          本来就是同一个决策的三面。
        </p>
        <p className="text-xs mt-3">
          {pro ? (
            <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-medium">
              <Check className="w-3.5 h-3.5" />
              {PLAN_LABEL.pro}已开通，以下能力全部可用
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-muted">
              <Lock className="w-3.5 h-3.5" />
              当前为 {PLAN_LABEL.free}
              {session ? "" : "（未登录）"} ·{" "}
              <Link href="/pricing" className="text-primary hover:underline">查看能力对照</Link>
            </span>
          )}
        </p>
      </header>

      {groups.map((g) => (
        <section key={g.group}>
          <div className="flex items-baseline gap-2 mb-3">
            <h2 className="font-bold text-lg tracking-tight">{g.group}</h2>
            <span className="text-[10px] text-muted">{g.items.length} 项能力</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {g.items.map((f) => (
              <Card key={f.key} className="p-4 flex flex-col">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-bold text-sm leading-snug">{f.name}</h3>
                  <span
                    className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                      f.ready
                        ? "border-emerald-600/30 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400"
                        : "border-border bg-border/40 text-muted"
                    }`}
                  >
                    {f.ready ? "已交付" : "规划中"}
                  </span>
                </div>

                <div className="rounded-lg bg-border/30 border border-border/60 px-2.5 py-2 mb-2.5 space-y-1.5">
                  <p className="text-[11px] leading-relaxed">
                    <span className="text-muted font-semibold">普通版 </span>
                    <span className="text-muted">{f.free}</span>
                  </p>
                  <p className="text-[11px] leading-relaxed">
                    <span className="text-primary font-semibold">专业版 </span>
                    <span className="text-foreground/85">{f.pro}</span>
                  </p>
                </div>

                <div className="mt-auto flex flex-wrap gap-1.5">
                  {f.modules.map((m) => (
                    <Link
                      key={m}
                      href={m}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-primary/8 text-primary border border-primary/20 hover:bg-primary/15"
                    >
                      打开 {m}
                    </Link>
                  ))}
                </div>
              </Card>
            ))}
          </div>

          {/* 分区内直接可用的操作面：能在这里做的事就别让用户再跳一次 */}
          {g.group === "深度解读" && <PolicyDeepList enabled={pro} />}
          {g.group === "批量计算" && <SectorRankTable enabled={pro} />}
          {g.group === "研究留档" && <ExportButtons enabled={pro} />}
        </section>
      ))}

      <div className="flex items-center justify-between border-t border-border pt-4">
        <Link href="/pricing" className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-primary">
          <ArrowLeft className="w-3.5 h-3.5" /> 能力对照表
        </Link>
        <p className="text-[10px] text-muted">
          能力清单与分区定义在 lib/plan.ts（共 {PRO_FEATURES.length} 项），本页由其自动生成
        </p>
      </div>
    </div>
  );
}