"use client";
import { useState } from "react";
import { HistoryEvent, CAT_TONE, REGION_TONE, REGION_LABEL } from "@/lib/data/history";
import { Badge } from "@/components/ui";

export default function HistoryTimeline({ events }: { events: HistoryEvent[] }) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  return (
    <div className="relative pl-6 border-l-2 border-border">
      {events.map((e, i) => {
        const isOpen = openIdx === i;
        return (
          <div key={i} className="relative pb-5 last:pb-0">
            <span
              className={`absolute -left-[31px] top-1 w-3 h-3 rounded-full border-2 border-background ${
                e.region === "cn" ? "bg-red-500" : "bg-blue-500"
              }`}
            />
            <button
              onClick={() => setOpenIdx(isOpen ? null : i)}
              className="w-full text-left group"
            >
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`font-mono font-bold ${e.year < 0 ? "text-green-600" : "text-primary"}`}>
                  {e.year < 0 ? `公元前 ${-e.year} 年` : `${e.year} 年`}
                </span>
                <Badge tone={(CAT_TONE[e.category] ?? "gray") as any}>{e.category}</Badge>
                <Badge tone={(REGION_TONE[e.region] ?? "gray") as any}>{REGION_LABEL[e.region]}</Badge>
                <span className={`text-primary text-xs ml-auto transition-transform ${isOpen ? "rotate-180" : ""}`}>▾</span>
              </div>
              <p className="font-semibold mt-1 group-hover:text-primary transition-colors">{e.title}</p>
              <p className="text-sm text-muted leading-relaxed">{e.summary}</p>
            </button>
            {isOpen && (
              <div className="mt-3 pl-0 space-y-3 text-sm">
                <p className="leading-relaxed border-l-2 border-primary/30 pl-3 text-muted">{e.detail}</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                  {e.figures && (
                    <p className="rounded-lg bg-border/30 px-3 py-2">
                      <span className="font-bold block mb-0.5">关键人物</span>{e.figures}
                    </p>
                  )}
                  {e.impact && (
                    <p className="rounded-lg bg-border/30 px-3 py-2">
                      <span className="font-bold block mb-0.5">历史影响</span>{e.impact}
                    </p>
                  )}
                  {e.source && (
                    <p className="rounded-lg bg-border/30 px-3 py-2">
                      <span className="font-bold block mb-0.5">史料出处</span>{e.source}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}