import { ROADMAP } from "@/lib/data/gmrds";

const VERSION_COLORS = ["#94a3b8", "#3b82f6", "#a855f7"];

/**
 * 版本演进时间线（V1.0 → V2.0 → V3.0 阶梯上升）
 * 体现能力逐版增强：基础 → 专业 → 平台。
 */
export default function VersionTimeline() {
  const width = 680;
  const height = 210;
  const padX = 70;
  const baselineY = 150;
  const stepXs = ROADMAP.map((_, i) => padX + (i * (width - padX * 2)) / (ROADMAP.length - 1));

  return (
    <figure className="rounded-xl border border-border bg-card p-4 overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} style={{ minWidth: 560 }} className="w-full h-auto" role="img" aria-label="版本演进时间线">
        {/* 基线 */}
        <line x1={padX - 20} y1={baselineY} x2={width - padX + 20} y2={baselineY} stroke="var(--border)" strokeWidth={1.4} />
        {/* 阶梯上升线 */}
        {stepXs.map((x, i) => {
          const y = baselineY - (i + 1) * 34;
          const nextX = stepXs[i + 1];
          return (
            <g key={i}>
              {i === 0 && <line x1={padX - 20} y1={baselineY} x2={x} y2={baselineY} stroke="var(--border)" strokeWidth={1.2} strokeDasharray="4 3" />}
              {/* 上升段 */}
              {nextX != null && (
                <line x1={x} y1={baselineY} x2={nextX} y2={baselineY - (i + 2) * 34} stroke={VERSION_COLORS[i]} strokeWidth={2.2} opacity={0.85} />
              )}
              {/* 节点 */}
              <circle cx={x} cy={y} r={13} fill={VERSION_COLORS[i]} />
              <circle cx={x} cy={y} r={5} fill="#fff" />
              <text x={x} y={y - 24} textAnchor="middle" fontSize={13} fontWeight={800} fill={VERSION_COLORS[i]}>{ROADMAP[i].version}</text>
              <text x={x} y={y - 9} textAnchor="middle" fontSize={10} fill="var(--foreground)">{ROADMAP[i].name}</text>
              {/* 边界说明 */}
              <text x={x} y={baselineY + 24} textAnchor="middle" fontSize={9} fill="var(--muted)">{ROADMAP[i].boundary}</text>
            </g>
          );
        })}
        {/* 上升标注 */}
        <text x={width - padX} y={baselineY - 110} textAnchor="end" fontSize={9} fill="var(--muted)" opacity={0.75}>能力逐版增强 →</text>
      </svg>
      <figcaption className="text-[11px] text-muted mt-2 leading-relaxed">
        <b className="text-foreground">图注：</b>版本阶梯反映能力演进——V1.0 建立框架与数据底座（人工主导），
        V2.0 叠加量化与跨市场联动（数据自动化），V3.0 平台化与 AI 赋能（全流程线上化）；每版保留上版成果，平滑升级。
      </figcaption>
    </figure>
  );
}
