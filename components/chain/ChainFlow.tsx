"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { clamp } from "@/lib/utils";
import type { ChainSegment, StaticChain } from "@/lib/data/chains";

const STAGE_COLOR: Record<string, string> = { 上游: "#0891b2", 中游: "#c8102e", 下游: "#4f46e5" };

function Arrow() {
  return (
    <div className="flex items-center justify-center w-7 shrink-0 self-stretch">
      <svg width="20" height="40" viewBox="0 0 20 40" className="text-muted/60">
        <line x1="10" y1="2" x2="10" y2="30" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3" />
        <polygon points="4,28 10,38 16,28" fill="currentColor" />
      </svg>
    </div>
  );
}

export default function ChainFlow({ chain }: { chain: StaticChain }) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [active, setActive] = useState<ChainSegment | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; ox: number; oy: number } | null>(null);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setScale((s) => clamp(s * (e.deltaY < 0 ? 1.12 : 0.89), 0.5, 2.2));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const stages = ["上游", "中游", "下游"] as const;
  const segmentsByStage = stages.map((st) => ({
    stage: st,
    segments: chain.segments.filter((s) => s.stage === st),
  }));

  return (
    <div className="card p-3 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted">滚轮缩放 · 拖拽平移 · 点击环节查看代表公司</span>
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => setScale((s) => clamp(s * 1.2, 0.5, 2.2))}
            className="px-2 py-0.5 text-xs border border-border rounded hover:border-primary/60 transition-colors"
          >
            +
          </button>
          <button
            onClick={() => setScale((s) => clamp(s / 1.2, 0.5, 2.2))}
            className="px-2 py-0.5 text-xs border border-border rounded hover:border-primary/60 transition-colors"
          >
            −
          </button>
          <button
            onClick={() => {
              setScale(1);
              setOffset({ x: 0, y: 0 });
            }}
            className="px-2 py-0.5 text-xs border border-border rounded hover:border-primary/60 transition-colors"
          >
            复位
          </button>
        </div>
      </div>

      <div
        ref={boxRef}
        className="relative h-[380px] overflow-hidden rounded-lg border border-border/60 select-none"
        style={{ touchAction: "none" }}
      >
        <div
          className={`absolute inset-0 flex items-stretch ${dragging ? "cursor-grabbing" : "cursor-grab"}`}
          onPointerDown={(e) => {
            setDragging(true);
            dragRef.current = { startX: e.clientX, startY: e.clientY, ox: offset.x, oy: offset.y };
            (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (!dragRef.current) return;
            setOffset({
              x: dragRef.current.ox + (e.clientX - dragRef.current.startX),
              y: dragRef.current.oy + (e.clientY - dragRef.current.startY),
            });
          }}
          onPointerUp={() => {
            setDragging(false);
            dragRef.current = null;
          }}
          onPointerLeave={() => {
            if (dragging) {
              setDragging(false);
              dragRef.current = null;
            }
          }}
        >
          <div
            className="flex items-stretch gap-1 mx-auto my-auto"
            style={{
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
              transformOrigin: "center",
            }}
          >
            {segmentsByStage.map((g, gi) => (
              <div key={g.stage} className="flex items-stretch">
                {gi > 0 && <Arrow />}
                <div className="flex flex-col w-[228px] shrink-0">
                  <div
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg mb-2 text-sm font-medium"
                    style={{ background: `${STAGE_COLOR[g.stage]}1a`, color: STAGE_COLOR[g.stage] }}
                  >
                    <span className="w-2 h-2 rounded-full" style={{ background: STAGE_COLOR[g.stage] }} />
                    {g.stage}
                    <span className="text-xs font-normal opacity-70 ml-auto">{g.segments.length} 环节</span>
                  </div>
                  <div className="space-y-2">
                    {g.segments.map((seg) => (
                      <button
                        key={seg.name}
                        type="button"
                        onClick={() => setActive(active === seg ? null : seg)}
                        className={`w-full text-left border rounded-lg px-3 py-2 transition-all ${
                          active === seg
                            ? "border-primary ring-2 ring-primary/20 bg-primary/5"
                            : "border-border hover:border-primary/50 bg-background"
                        }`}
                      >
                        <p className="text-sm font-semibold leading-tight">{seg.name}</p>
                        <p className="text-[11px] text-muted mt-0.5 leading-snug line-clamp-2">{seg.products}</p>
                        <p className="text-[11px] text-muted mt-1 font-mono">
                          {seg.companies.length} 家代表公司
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {active && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-1.5">
          <p className="text-xs font-medium text-primary">
            {active.stage} · {active.name} <span className="text-muted font-normal">— {active.products}</span>
          </p>
          <div className="flex flex-wrap gap-1.5">
            {active.companies.map((c) => (
              <Link
                key={c.name}
                href={`/stock?q=${encodeURIComponent(c.name)}`}
                className="text-xs px-2 py-0.5 rounded bg-background border border-border hover:border-primary/60 hover:text-primary transition-colors"
              >
                {c.name}
                {c.role && <span className="text-muted ml-1">{c.role}</span>}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}