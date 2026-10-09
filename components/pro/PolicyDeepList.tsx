import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import ProGate from "@/components/ProGate";
import { getPoliciesWithDeepAnalysis } from "@/lib/data/queries";

/**
 * 深度解读分区的操作面：列出**已产出专业机构视角**的政策，点进去就能读。
 *
 * 为什么这个分区需要它：另外两个分区（批量计算 / 研究留档）各自嵌了可用面板，
 * 只有深度解读分区是一张卡片 + 一个跳转链接 —— 专业版用户落进来看到的是
 * "这里有个能力"，而不是"这里有内容"。能力卡片说明边界，操作面才交付价值。
 *
 * 只列专业层真的存在的条目：列表里每一项都必须点进去就能读，
 * 否则这个分区就退化成"看起来有内容"的摆设。
 */
export default async function PolicyDeepList({ enabled }: { enabled: boolean }) {
  if (!enabled) {
    return (
      <div className="mt-3">
        <ProGate feature="policy-deep" compact />
      </div>
    );
  }

  const items = await getPoliciesWithDeepAnalysis(6);

  if (!items.length) {
    return (
      <div className="mt-3 rounded-lg border border-border bg-border/20 p-3">
        <p className="text-[11px] text-muted leading-relaxed">
          暂无已生成「专业机构视角」的政策。可在
          <Link href="/policy" className="mx-1 text-primary hover:underline">政策解读</Link>
          页对任一政策点「生成解读」，生成后这里会列出可直接阅读的条目。
        </p>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-lg border border-border bg-border/20 p-3">
      <p className="text-xs font-bold tracking-wide text-primary mb-2">
        最新机构视角解读（{items.length} 条可直接阅读）
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {items.map((p) => (
          <Link
            key={p.id}
            href={`/policy/${p.id}`}
            className="rounded-md border border-border/60 bg-card p-2.5 hover:border-primary/40 transition-colors group"
          >
            <div className="flex items-start justify-between gap-2 mb-1">
              <span className="text-[11px] font-semibold leading-snug line-clamp-2">{p.title}</span>
              <ArrowUpRight className="w-3 h-3 shrink-0 mt-0.5 text-muted group-hover:text-primary transition-colors" />
            </div>
            <p className="text-[10px] text-muted leading-relaxed line-clamp-2">{p.excerpt}…</p>
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              {p.category && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/8 text-primary border border-primary/20">
                  {p.category}
                </span>
              )}
              {p.hasDetail && (
                <span className="text-[9px] px-1.5 py-0.5 rounded border border-border text-muted">
                  含趋势研判
                </span>
              )}
              {p.publishDate && <span className="text-[9px] text-muted">{p.publishDate}</span>}
            </div>
          </Link>
        ))}
      </div>
      <p className="text-[10px] text-muted leading-relaxed mt-2 border-t border-border/60 pt-2">
        列表只包含专业层已生成的条目 —— 不列「可以生成但还没生成」的政策，
        免得点进去是空的。
      </p>
    </div>
  );
}