import type { Metadata } from "next";
import { Suspense } from "react";
import LabTerminal from "@/components/lab/LabTerminal";

export const metadata: Metadata = {
  title: "K线实验室 · 实操教学终端",
  description: "股票/指数可视化实操教学终端：K线实验台、形态识别、财务雷达、估值测算、买卖点扫描、技术位分析、财务三表趋势、策略回测 + 全球指数/市场宽度/市场脉搏 —— 全部基于真实行情与财报数据。支持 /lab?secid= 预选标的。",
};

export default function Lab() {
  return (
    <Suspense>
      <LabTerminal />
    </Suspense>
  );
}
