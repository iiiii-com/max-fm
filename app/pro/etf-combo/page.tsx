import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getSession } from "@/lib/auth";
import { isPro, PLAN_LABEL } from "@/lib/plan";
import ProGate from "@/components/ProGate";
import EtfComboPanel from "@/components/pro/EtfComboPanel";

export const dynamic = "force-dynamic";
export const metadata = { title: "ETF 组合对比与相关性 · 专业版 | Max 财经" };

export default async function ProEtfComboPage() {
  const session = await getSession();
  const pro = isPro(session);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 space-y-5">
      <header>
        <div className="flex items-center gap-2 text-xs text-muted mb-3">
          <Link href="/pro" className="hover:text-primary">专业版工作台</Link>
          <span>/</span>
          <span className="text-foreground font-medium">ETF 组合对比与相关性</span>
        </div>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="font-black text-2xl tracking-tight mb-2">ETF 组合对比与相关性</h1>
            <p className="text-sm text-muted leading-relaxed max-w-3xl">
              把 2–6 只 ETF 放进同一窗口：归一化走势看清相对强弱，日收益相关矩阵看清是否同源，
              等权组合的年化波动与最大回撤回答「这样配到底分散了什么」。
              普通版在{" "}
              <Link href="/market?tab=etf" className="text-primary hover:underline">ETF 专区</Link>
              已能看行情、K 线与基础对比；这里是专业版的组合视角。
            </p>
          </div>
          <span className="text-[10px] font-black px-2 py-1 rounded bg-primary text-white shrink-0">
            {PLAN_LABEL.pro}
          </span>
        </div>
      </header>

      {pro ? <EtfComboPanel /> : <ProGate feature="etf-combo" />}

      <div className="flex items-center justify-between border-t border-border pt-3">
        <Link href="/pro" className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-primary">
          <ArrowLeft className="w-3.5 h-3.5" /> 返回专业版工作台
        </Link>
        <Link href="/pricing" className="text-xs text-primary hover:underline">能力对照与开通方式 →</Link>
      </div>
    </div>
  );
}
