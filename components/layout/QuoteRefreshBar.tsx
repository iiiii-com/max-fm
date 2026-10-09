"use client";

import { useEffect, useState } from "react";
import { useRefresh, REFRESH_INTERVAL } from "@/lib/hooks/refresh";
import { RefreshCw, Radio, Clock } from "lucide-react";

/**
 * 行情刷新控制条：自动刷新开关 + 最近更新时间 + 手动刷新。
 *
 * 时间必须**只在客户端渲染**：
 * lastUpdated 是挂载时才确定的（Date.now()），且 getHours() 取的是本地时区 ——
 * 服务端（Vercel 跑在 UTC）与客户端（用户本地时区）算出来的时刻必然不同，
 * 直接渲染会触发 hydration mismatch，React 随后在客户端重建整棵树。
 * 重建过程中图表容器会被卸载重建，表现就是"K 线有时候不显示"。
 * 因此 SSR 阶段先输出占位符，挂载后再显示真实时间。
 */
export default function QuoteRefreshBar() {
  const { enabled, toggle, bump, lastUpdated } = useRefresh();
  const [spinning, setSpinning] = useState(false);
  /** 挂载前一律显示占位符，避免服务端/客户端时间不一致 */
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const manual = () => {
    setSpinning(true);
    bump();
    setTimeout(() => setSpinning(false), 600);
  };

  const time = new Date(lastUpdated);
  const hhmmss = `${String(time.getHours()).padStart(2, "0")}:${String(time.getMinutes()).padStart(2, "0")}:${String(time.getSeconds()).padStart(2, "0")}`;

  return (
    <div className="flex items-center gap-3 text-xs text-muted">
      <div className="flex items-center gap-1.5">
        <span className="relative inline-flex w-2 h-2">
          <span
            className={`absolute inline-flex h-full w-full rounded-full opacity-60 ${enabled ? "bg-primary animate-ping" : "bg-border"}`}
          />
          <span className={`relative inline-flex rounded-full w-2 h-2 ${enabled ? "bg-primary" : "bg-muted/50"}`} />
        </span>
        <button
          onClick={toggle}
          className="flex items-center gap-1.5 hover:text-foreground transition-colors"
          role="switch"
          aria-checked={enabled}
          title="开启后每 30 秒自动刷新行情"
        >
          <Radio className="w-3.5 h-3.5" />
          自动刷新 {enabled ? "开" : "关"}
        </button>
      </div>
      <span className="hidden sm:flex items-center gap-1" suppressHydrationWarning>
        <Clock className="w-3.5 h-3.5" />
        {mounted ? hhmmss : "--:--:--"}
      </span>
      <button
        onClick={manual}
        className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-border hover:border-primary/50 hover:text-primary transition-colors"
        title="立即刷新"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${spinning ? "animate-spin" : ""}`} />
        刷新
      </button>
      <span className="hidden md:inline text-[10px] text-muted/80">
        {REFRESH_INTERVAL / 1000}s · 数据源不可用时自动降级
      </span>
    </div>
  );
}
