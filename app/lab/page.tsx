import type { Metadata } from "next";
import LabPage from "@/components/lab/LabPage";

export const metadata: Metadata = {
  title: "实操工具箱 · K线实验室",
  description: "股票/指数可视化实操教学：K线实验台、形态识别、财务雷达、估值测算、买卖点扫描、技术位分析、财务三表趋势、策略回测 —— 全部基于真实行情与财报数据。",
};

export default function Lab() {
  return <LabPage />;
}
