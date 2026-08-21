"use client";

import type { Regime } from "@/lib/data/crisis/types";

const REGIME_META: Record<Regime, { label: string; color: string; bg: string }> = {
  crash: { label: "回调 · 恐慌下行", color: "#dc2626", bg: "rgba(220,38,38,0.06)" },
  rally: { label: "上涨 · 趋势上行", color: "#16a34a", bg: "rgba(22,163,74,0.06)" },
  range: { label: "震荡 · 横盘整理", color: "#8b8b85", bg: "rgba(139,139,133,0.07)" },
};

function Candle({
  x,
  w,
  h,
  color,
  wick,
}: {
  x: number;
  w: number;
  h: number;
  color: string;
  wick: number;
}) {
  const top = 90 - h;
  return (
    <g>
      <line x1={x + w / 2} y1={top + h} x2={x + w / 2} y2={Math.max(6, top - wick)} stroke={color} strokeWidth={1.4} />
      <line x1={x + w / 2} y1={top} x2={x + w / 2} y2={Math.min(96, top + h + wick)} stroke={color} strokeWidth={1.4} />
      <rect x={x} y={top} width={w} height={h} rx={1.4} fill={color} opacity={0.88} />
    </g>
  );
}

export default function StageIllustration({
  regime,
  title,
  height = 150,
}: {
  regime: Regime;
  title?: string;
  height?: number;
}) {
  const meta = REGIME_META[regime];
  const W = 340;
  const H = 110;

  let candles: Array<{ x: number; w: number; h: number; wick: number; color: string }> = [];
  if (regime === "crash") {
    const hs = [34, 40, 26, 44, 30, 48, 36, 52, 42, 56];
    candles = hs.map((h, i) => ({
      x: 34 + i * 26,
      w: 13,
      h: Math.min(h, 60),
      wick: 5,
      color: meta.color,
    }));
  } else if (regime === "rally") {
    const hs = [30, 34, 40, 37, 46, 50, 47, 56, 60, 62];
    candles = hs.map((h, i) => ({
      x: 34 + i * 26,
      w: 13,
      h: Math.min(h, 62),
      wick: 4,
      color: meta.color,
    }));
  } else {
    const hs = [40, 46, 38, 50, 42, 48, 36, 52, 44, 46];
    candles = hs.map((h, i) => ({
      x: 34 + i * 26,
      w: 13,
      h: Math.min(h, 56),
      wick: 6,
      color: meta.color,
    }));
  }

  return (
    <div
      className="rounded-xl border border-border overflow-hidden flex flex-col justify-center items-center px-4"
      style={{ height, background: meta.bg }}
    >
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" role="img">
        <defs>
          <style>{`
            @keyframes candleGrow { 0% { transform: scaleY(0); } 100% { transform: scaleY(1); } }
            @keyframes candleGrowDown { 0% { transform: scaleY(0) translateY(100%); } 100% { transform: scaleY(1) translateY(0); } }
            @keyframes iconPulse { 0%, 100% { opacity: 0.8; transform: scale(1); } 50% { opacity: 1; transform: scale(1.12); } }
            @keyframes arrowBounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
            .c-anim { animation: candleGrow 0.5s ease both; transform-origin: bottom; }
            .c-anim-r { animation: candleGrow 0.5s ease both; transform-origin: bottom; }
            .icon-pulse { animation: iconPulse 2.2s ease-in-out infinite; }
            .arrow-bounce { animation: arrowBounce 1.4s ease-in-out infinite; }
          `}</style>
        </defs>
        <line x1={20} y1={94} x2={W - 14} y2={94} stroke="rgba(128,128,128,0.25)" strokeWidth={1} strokeDasharray="3 3" />
        <line x1={20} y1={64} x2={W - 14} y2={64} stroke="rgba(128,128,128,0.12)" strokeWidth={1} strokeDasharray="3 3" />
        <line x1={20} y1={34} x2={W - 14} y2={34} stroke="rgba(128,128,128,0.12)" strokeWidth={1} strokeDasharray="3 3" />
        {candles.map((c, i) => (
          <g key={i} style={{ animationDelay: `${i * 0.06}s` }} className="c-anim">
            <Candle {...c} />
          </g>
        ))}
        {regime === "crash" && (
          <g transform="translate(262,14)" className="icon-pulse">
            <path
              d="M4 0 L20 0 L16 9 L26 9 L8 26 L12 15 L0 15 Z"
              fill="#f59e0b"
              opacity={0.95}
            />
          </g>
        )}
        {regime === "rally" && (
          <g transform="translate(266,16)" className="arrow-bounce">
            <path
              d="M8 24 L8 4 L2 10 L0 7 L8 0 L16 7 L14 10 L8 4 L8 24 Z"
              fill="#f59e0b"
              opacity={0.95}
            />
          </g>
        )}
        {regime === "range" && (
          <g transform="translate(262,12)" className="icon-pulse">
            <rect x="0" y="0" width="14" height="24" rx="3" fill="none" stroke="#f59e0b" strokeWidth={1.6} />
            <line x1="4" y1="12" x2="16" y2="12" stroke="#f59e0b" strokeWidth={1.6} />
            <line x1="7" y1="4" x2="7" y2="20" stroke="#f59e0b" strokeWidth={1.6} />
          </g>
        )}
        <text x={22} y={24} fontSize={10} fill={meta.color} fontWeight={700}>
          {title ?? meta.label}
        </text>
      </svg>
      <p className="text-center text-[11px] font-medium text-muted -mt-1.5 pb-1.5">{meta.label}</p>
    </div>
  );
}