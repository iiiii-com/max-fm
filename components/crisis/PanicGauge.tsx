"use client";

const CX = 100;
const CY = 100;
const R = 82;

function polar(deg: number): [number, number] {
  const rad = (deg * Math.PI) / 180;
  return [CX + R * Math.cos(rad), CY - R * Math.sin(rad)];
}

function arc(startDeg: number, endDeg: number): string {
  const [sx, sy] = polar(startDeg);
  const [ex, ey] = polar(endDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${sx.toFixed(2)} ${sy.toFixed(2)} A ${R} ${R} 0 ${large} 1 ${ex.toFixed(2)} ${ey.toFixed(2)}`;
}

const SEGMENTS = [
  { from: 180, to: 108, color: "#16a34a" },
  { from: 108, to: 54, color: "#eab308" },
  { from: 54, to: 0, color: "#dc2626" },
];

export default function PanicGauge({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  const angle = -90 + v * 1.8;
  const panic = v > 80;

  return (
    <div className="flex flex-col items-center w-full">
      <div className="flex items-center justify-between w-full mb-1">
        <span className="text-xs font-semibold">恐慌指数</span>
        <span className={`text-sm font-mono font-bold ${panic ? "text-primary" : ""}`}>{Math.round(v)}</span>
      </div>
      <svg viewBox="0 0 200 116" className="w-full max-w-[190px]">
        {SEGMENTS.map((s) => (
          <path key={s.from} d={arc(s.from, s.to)} stroke={s.color} strokeWidth={11} fill="none" strokeLinecap="round" opacity={0.9} />
        ))}
        <g style={{ transition: "transform 0.7s cubic-bezier(0.4, 0, 0.2, 1)" }} transform={`rotate(${angle} ${CX} ${CY})`}>
          <line x1={CX} y1={CY} x2={CX} y2={24} stroke="#374151" strokeWidth={3} strokeLinecap="round" />
          <circle cx={CX} cy={CY} r={5.5} fill="#374151" />
        </g>
        <text x={CX} y={112} textAnchor="middle" fontSize={10} className="fill-muted">0 · 40 · 70 · 100</text>
      </svg>
      {panic && (
        <p className="mt-1.5 w-full text-center text-[11px] font-semibold text-white bg-primary rounded px-2 py-1 animate-pulse">
          市场进入恐慌区
        </p>
      )}
    </div>
  );
}