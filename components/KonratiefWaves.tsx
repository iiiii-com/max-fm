"use client";
import { useState } from "react";
import { Card, Badge } from "@/components/ui";

export type KonratiefWave = {
  no: string;
  name: string;
  years: string;
  tech: string;
  sector: string;
  countries: string;
  phase: string;
  detail: string;
  leaders: string;
  milestones: { year: number; title: string; note: string }[];
  china: { year: number; title: string; note: string }[];
};

export default function KonratiefWaves({ waves }: { waves: KonratiefWave[] }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="space-y-3">
      {waves.map((w, i) => {
        const isOpen = open === i;
        return (
          <Card key={w.no} className={`p-0 overflow-hidden ${isOpen ? "ring-1 ring-primary/40" : ""}`}>
            <button
              onClick={() => setOpen(isOpen ? null : i)}
              className="w-full flex items-center gap-3 p-4 text-left hover:bg-border/20 transition-colors"
            >
              <Badge tone={w.no === "第六波" ? "amber" : "red"}>{w.no}</Badge>
              <span className="font-mono text-sm text-muted shrink-0 hidden sm:inline">{w.years}</span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold leading-snug">{w.tech}</p>
                <p className="text-sm text-muted">{w.name} · {w.phase}</p>
              </div>
              <span className={`text-primary text-lg shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}>▾</span>
            </button>
            {isOpen && (
              <div className="px-4 pb-4 pt-1 space-y-4 border-t border-border">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  <p><span className="text-muted">时间跨度：</span><b className="font-mono">{w.years}</b></p>
                  <p><span className="text-muted">核心国家：</span>{w.countries}</p>
                  <p className="md:col-span-2"><span className="text-muted">主导产业：</span>{w.sector}</p>
                  <p className="md:col-span-2"><span className="text-muted">代表人物：</span>{w.leaders}</p>
                </div>
                <p className="text-sm leading-relaxed text-muted">{w.detail}</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-bold text-muted uppercase tracking-wide mb-2">关键里程碑</p>
                    <ul className="space-y-2">
                      {w.milestones.map((m) => (
                        <li key={m.year + m.title} className="text-sm flex gap-2">
                          <span className="font-mono font-bold text-primary shrink-0">{m.year}</span>
                          <span><b>{m.title}</b><span className="text-muted"> — {m.note}</span></span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-muted uppercase tracking-wide mb-2">中国同期</p>
                    <ul className="space-y-2">
                      {w.china.map((m) => (
                        <li key={m.year + m.title} className="text-sm flex gap-2">
                          <span className="font-mono font-bold text-primary shrink-0">{m.year}</span>
                          <span><b>{m.title}</b><span className="text-muted"> — {m.note}</span></span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}