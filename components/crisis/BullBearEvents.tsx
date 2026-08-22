"use client";

import { useMemo, useState } from "react";
import { Badge, Card } from "@/components/ui";
import { BULL_BEAR_CYCLES } from "@/lib/data/bullbear";
import { BULL_BEAR_EVENTS, groupEventsByCycle, EVENT_DIR_META } from "@/lib/data/bullbear-events";

/** 牛熊关键事件卡片：按轮次分组，深度解读事件对市场的影响 */
export default function BullBearEvents() {
  const [openCycle, setOpenCycle] = useState<string | null>("牛6-大牛市");

  const grouped = useMemo(() => groupEventsByCycle(), []);
  // 仅展示有事件的轮次，按牛熊周期顺序
  const order = useMemo(() => {
    const idx = new Map(BULL_BEAR_CYCLES.map((c, i) => [c.period, i]));
    return [...grouped.keys()].sort((a, b) => (idx.get(a) ?? 99) - (idx.get(b) ?? 99));
  }, [grouped]);

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-muted">
        共 {BULL_BEAR_EVENTS.length} 个关键事件 · 覆盖 {grouped.size} 轮牛熊 · 事件日期与涨跌幅均基于上证综指真实历史行情
      </p>
      {order.map((cycleName) => {
        const cycle = BULL_BEAR_CYCLES.find((c) => c.period === cycleName);
        const events = grouped.get(cycleName)!;
        const isOpen = openCycle === cycleName;
        const isBull = cycle?.phase === "bull";
        return (
          <Card key={cycleName} className="overflow-hidden">
            <button
              onClick={() => setOpenCycle(isOpen ? null : cycleName)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/20 transition-colors"
            >
              <span className={`w-2 h-2 rounded-full shrink-0 ${isBull ? "bg-red-500" : "bg-green-500"}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-sm">{cycleName}</span>
                  <Badge tone={isBull ? "red" : "green"}>{isBull ? "牛市" : "熊市"}</Badge>
                  {cycle && (
                    <span className="text-[11px] text-muted font-mono">
                      {cycle.from.slice(0, 7)} ~ {cycle.to.slice(0, 7)} · {cycle.changePct >= 0 ? "+" : ""}{cycle.changePct}%
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-muted mt-0.5">{events.length} 个关键事件</p>
              </div>
              <span className={`text-primary text-xs transition-transform ${isOpen ? "rotate-180" : ""}`}>▾</span>
            </button>

            {isOpen && (
              <div className="px-4 pb-4 space-y-3 border-t border-border/60 pt-3">
                {events.map((ev) => {
                  const meta = EVENT_DIR_META[ev.direction];
                  return (
                    <div key={ev.date + ev.name} className="rounded-lg border border-border p-3.5 bg-background">
                      <div className="flex items-start gap-3 flex-wrap">
                        <span className="font-mono text-xs font-bold text-primary whitespace-nowrap mt-0.5">
                          {ev.date}
                        </span>
                        <div className="flex-1 min-w-[200px]">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm">{ev.name}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${meta.cls}`}>{meta.label}</span>
                            <Badge tone="gray">{ev.type}</Badge>
                          </div>
                          <p className="text-xs text-muted mt-1.5 leading-relaxed">{ev.analysis}</p>
                          {ev.movePct && (
                            <p className="text-xs mt-2 font-mono">
                              <span className="text-muted">行情表现：</span>
                              <span className={ev.direction === "down" || ev.direction === "volatile" ? "down font-semibold" : "up font-semibold"}>
                                {ev.movePct}
                              </span>
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
