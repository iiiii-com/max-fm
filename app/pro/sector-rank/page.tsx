import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getSession } from "@/lib/auth";
import { isPro, PLAN_LABEL } from "@/lib/plan";
import ProGate from "@/components/ProGate";
import SectorRankTable from "@/components/pro/SectorRankTable";

export const dynamic = "force-dynamic";
export const metadata = { title: "行业景气排行 · 专业版 | Max 财经" };

export default async function ProSectorRankPage() {
  const session = await getSession();
  const pro = isPro(session);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 space-y-5">
      <header>
        <div className="flex items-center gap-2 text-xs text-muted mb-3">
          <Link href="/pro" className="hover:text-primary">专业版工作台</Link>
          <span>/</span>
          <span className="text-foreground font-medium">行业景气排行</span>
        </div>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="font-black text-2xl tracking-tight mb-2">行业景气排行</h1>
            <p className="text-sm text-muted leading-relaxed max-w-3xl">
              多板块批量计算并横向排序：景气分（0–100）、位置分位、20/60 日动量、年化波动并排对照，
              适合先筛出「在动」的板块，再回到{" "}
              <Link href="/industry" className="text-primary hover:underline">产业地图</Link>
              看结构。普通版可在单个板块页查看景气分；这里是批量横向比较。
            </p>
          </div>
          <span className="text-[10px] font-black px-2 py-1 rounded bg-primary text-white shrink-0">
            {PLAN_LABEL.pro}
          </span>
        </div>
      </header>

      {!pro && <ProGate feature="sector-rank" compact />}
      <SectorRankTable enabled={pro} />

      <div className="flex items-center justify-between border-t border-border pt-3">
        <Link href="/pro" className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-primary">
          <ArrowLeft className="w-3.5 h-3.5" /> 返回专业版工作台
        </Link>
        <Link href="/pricing" className="text-xs text-primary hover:underline">能力对照与开通方式 →</Link>
      </div>
    </div>
  );
}
