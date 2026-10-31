import type { Metadata } from "next";
import { Suspense } from "react";
import LabTerminal from "@/components/lab/LabTerminal";
import { getSession } from "@/lib/auth";
import { isPro } from "@/lib/plan";

export const metadata: Metadata = {
  title: "K线实验室 · 实操教学终端",
  description: "股票/指数可视化实操教学终端：K线实验台、形态识别、财务雷达、估值测算、买卖点扫描、技术位分析、财务三表趋势、策略回测 + 全球指数/市场宽度/市场脉搏 —— 全部基于真实行情与财报数据。支持 /lab?secid= 预选标的。",
};

export const dynamic = "force-dynamic";

export default async function Lab() {
  const session = await getSession();
  const pro = isPro(session);
  return (
    <Suspense>
      <LabTerminal pro={pro} />
    </Suspense>
  );
}
