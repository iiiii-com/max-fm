import { DATA_LAYERS } from "@/lib/data/gmrds-deep";

const LAYER_COLORS: Record<string, string> = { L1: "#0ea5e9", L2: "#10b981", L3: "#ec4899" };
const LAYER_NAMES: Record<string, string> = { L1: "宏观层", L2: "行业层", L3: "标的层" };

/**
 * 三层数据联动架构图
 * L1 宏观 → L2 行业 → L3 标的 纵向传导；右侧映射说明；层间双箭头表达联动。
 */
export default function DataLayersDiagram() {
  const width = 680;
  const left = 24;
  const boxW = 360;
  const rightX = 420;
  const layerH = 96;
  const gap = 46;
  const top = 18;

  return (
    <figure className="rounded-xl border border-border bg-card p-4 overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${top + 3 * layerH + 2 * gap + 10}`} style={{ minWidth: 560 }} className="w-full h-auto" role="img" aria-label="三层数据联动架构图">
        {DATA_LAYERS.map((l, i) => {
          const y = top + i * (layerH + gap);
          const color = LAYER_COLORS[l.layer];
          return (
            <g key={l.layer}>
              {/* 层盒 */}
              <rect x={left} y={y} width={boxW} height={layerH} rx={10} fill="var(--card)" stroke={color} strokeWidth={1.6} strokeOpacity={0.7} />
              <rect x={left} y={y} width={54} height={layerH} rx={10} fill={color} opacity={0.14} />
              <text x={left + 27} y={y + 24} textAnchor="middle" fontSize={13} fontWeight={800} fill={color}>{l.layer}</text>
              <text x={left + 27} y={y + 44} textAnchor="middle" fontSize={9} fill="var(--muted)">{LAYER_NAMES[l.layer]}</text>
              <text x={left + 66} y={y + 20} fontSize={11.5} fontWeight={700} fill="var(--foreground)">{l.name}</text>
              {/* 字段 chips */}
              {l.fields.slice(0, 4).map((f, j) => (
                <g key={f}>
                  <rect x={left + 66 + (j % 2) * 150} y={y + 30 + Math.floor(j / 2) * 20} width={142} height={16} rx={4} fill={color} opacity={0.1} />
                  <text x={left + 66 + (j % 2) * 150 + 6} y={y + 41 + Math.floor(j / 2) * 20} fontSize={8.5} fill="var(--foreground)">{f}</text>
                </g>
              ))}
              {/* 映射说明 */}
              <text x={rightX} y={y + 16} fontSize={9.5} fontWeight={700} fill="var(--muted)">↔ 映射联动</text>
              {l.mapTo.map((m, j) => (
                <text key={j} x={rightX} y={y + 36 + j * 16} fontSize={9} fill="var(--muted)">
                  <tspan fill={LAYER_COLORS[m.layer]} fontWeight={700}>{m.layer}</tspan> {m.how.length > 22 ? m.how.slice(0, 22) + "…" : m.how}
                </text>
              ))}
            </g>
          );
        })}

        {/* 层间箭头（下行传导 + 上行校验） */}
        {[0, 1].map((i) => {
          const y1 = top + (i + 1) * layerH + i * gap;
          const y2 = y1 + gap;
          const cx = left + boxW / 2;
          return (
            <g key={`arrow-${i}`}>
              <line x1={cx} y1={y1} x2={cx} y2={y1 + gap - 12} stroke="#94a3b8" strokeWidth={1.4} />
              <polygon points={`${cx - 5},${y2 - 6} ${cx + 5},${y2 - 6} ${cx},${y2 + 4}`} fill="#94a3b8" />
              <text x={cx + 10} y={(y1 + y2) / 2} fontSize={8.5} fill="var(--muted)">传导 ↓</text>
              <line x1={cx + 56} y1={y2 - 8} x2={cx + 56} y2={y1 + 8} stroke="#cbd5e1" strokeWidth={1} strokeDasharray="3 3" />
              <text x={cx + 64} y={(y1 + y2) / 2} fontSize={8.5} fill="var(--muted)" opacity={0.7}>校验 ↑</text>
            </g>
          );
        })}
      </svg>
      <figcaption className="text-[11px] text-muted mt-2 leading-relaxed">
        <b className="text-foreground">图注：</b>宏观 / 行业 / 标的三层数据按统一字段标准存储；
        下行箭头表示传导（宏观更新 → 行业基准 → 标的池优先级），上行虚线表示校验（个股评分反哺行业景气、行业景气反证宏观周期）。
        任一节点更新自动级联下游决策节点。
      </figcaption>
    </figure>
  );
}
