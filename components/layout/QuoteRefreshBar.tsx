"use client";

import { useState } from "react";
import { useRefresh, REFRESH_INTERVAL } from "@/lib/hooks/refresh";
import { RefreshCw, Radio, Clock } from "lucide-react";

/** 行情刷新控制条：自动刷新开关 + 最近更新时间 + 手动刷新 */
export default function QuoteRefreshBar() {
  const { enabled, toggle, bump, lastUpdated } = useRefresh();
  const [spinning, setSpinning] = useState(false);

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
      <span className="hidden sm:flex items-center gap-1">
        <Clock className="w-3.5 h-3.5" />
        {hhmmss}
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
