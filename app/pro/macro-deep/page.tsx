import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getSession } from "@/lib/auth";
import { isPro, PLAN_LABEL } from "@/lib/plan";
import ProGate from "@/components/ProGate";
import MacroDeepPanel from "@/components/pro/MacroDeepPanel";
import { buildMonthlyReportData } from "@/lib/data/monthly-report";

export const dynamic = "force-dynamic";
export const metadata = { title: "宏观深度数据台 · 专业版 | Max 财经" };

export default async function ProMacroDeepPage() {
  const session = await getSession();
  const pro = isPro(session);
  const data = await buildMonthlyReportData();

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 space-y-5">
      <header>
        <div className="flex items-center gap-2 text-xs text-muted mb-3">
          <Link href="/pro" className="hover:text-primary">专业版工作台</Link>
          <span>/</span>
          <span className="text-foreground font-medium">宏观深度数据台</span>
        </div>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="font-black text-2xl tracking-tight mb-2">宏观深度数据台</h1>
            <p className="text-sm text-muted leading-relaxed max-w-3xl">
              {data.monthLabel} 的宏观底表：24 项指标的最新值、上期值与变化，宏观温度三因子得分与近 12 个月序列，
              全部数字带数据日期，可导出 CSV / Markdown 直接进周报。
              普通版在{" "}
              <Link href="/macro" className="text-primary hover:underline">宏观温度页</Link>
              已有温度计、三因子拆解与 AI 月报；这里补的是研究口径的底表与留档。
            </p>
          </div>
          <span className="text-[10px] font-black px-2 py-1 rounded bg-primary text-white shrink-0">
            {PLAN_LABEL.pro}
          </span>
        </div>
      </header>

      {pro ? (
        <MacroDeepPanel
          ym={data.ym}
          monthLabel={data.monthLabel}
          generatedAt={data.generatedAt}
          indicators={data.indicators}
          temperature={data.temperature}
          feeling={data.feeling}
        />
      ) : (
        <ProGate feature="macro-deep" />
      )}

      <div className="flex items-center justify-between border-t border-border pt-3">
        <Link href="/pro" className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-primary">
          <ArrowLeft className="w-3.5 h-3.5" /> 返回专业版工作台
        </Link>
        <Link href="/pricing" className="text-xs text-primary hover:underline">能力对照与开通方式 →</Link>
      </div>
    </div>
  );
}
