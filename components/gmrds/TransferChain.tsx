import { TRANSFER_CASE } from "@/lib/data/gmrds-deep";

const LAYER_COLORS: Record<string, string> = {
  "L1 宏观": "#0ea5e9",
  "L2 行业": "#10b981",
  "L3 标的": "#ec4899",
  "C01 决策": "#c8102e",
};

/**
 * 传导链示意图：宏观 → 行业 → 标的 → 决策 横向流程
 */
export default function TransferChain() {
  const n = TRANSFER_CASE.steps.length;
  const stepW = 122;
  const stepH = 108;
  const gap = 30;
  const width = n * stepW + (n - 1) * gap;
  const height = 150;
  const arrowX = stepW + 8;

  return (
    <figure className="rounded-xl border border-border bg-card p-4 overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} style={{ minWidth: 620 }} className="w-full h-auto" role="img" aria-label="宏观到决策传导链">
        {TRANSFER_CASE.steps.map((s, i) => {
          const color = LAYER_COLORS[s.layer] ?? "#64748b";
          const x = i * (stepW + gap);
          return (
            <g key={s.no}>
              <rect x={x} y={16} width={stepW} height={stepH} rx={10} fill="var(--card)" stroke={color} strokeWidth={1.5} strokeOpacity={0.7} />
              <rect x={x} y={16} width={stepW} height={24} rx={10} fill={color} opacity={0.14} />
              <text x={x + stepW / 2} y={32} textAnchor="middle" fontSize={9} fontWeight={800} fill={color}>{s.layer}</text>
              <text x={x + stepW / 2} y={60} textAnchor="middle" fontSize={11} fontWeight={700} fill="var(--foreground)">{s.title}</text>
              <text x={x + 8} y={78} fontSize={8.5} fill="var(--muted)">
                <tspan x={x + stepW / 2} textAnchor="middle">{s.detail.length > 26 ? s.detail.slice(0, 26) + "…" : s.detail}</tspan>
              </text>
              <text x={x + stepW / 2} y={110} textAnchor="middle" fontSize={8} fill={color} fontWeight={600}>
                {i < n - 1 ? "→ 输入下游" : "★ 决策落地"}
              </text>
              {/* 箭头 */}
              {i < n - 1 && (
                <g transform={`translate(${x + arrowX}, 70)`}>
                  <line x1={0} y1={0} x2={gap - 12} y2={0} stroke="#94a3b8" strokeWidth={1.6} />
                  <polygon points={`${gap - 12},-4 ${gap - 2},0 ${gap - 12},4`} fill="#94a3b8" />
                </g>
              )}
            </g>
          );
        })}
      </svg>
      <figcaption className="text-[11px] text-muted mt-2 leading-relaxed">
        <b className="text-foreground">图注：</b>六步传导链展示「宏观数据 → 资产决策」的完整路径——
        每步输出作为下一步输入，颜色对应数据层级（蓝=宏观 / 绿=行业 / 粉=标的 / 红=决策委员会）。数据均来自本站可溯源真实数据源。
      </figcaption>
    </figure>
  );
}
