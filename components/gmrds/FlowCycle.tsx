import { DECISION_FLOW } from "@/lib/data/gmrds";

/** 阶段主题色（与全站一致） */
const STAGE_COLORS = ["#0ea5e9", "#10b981", "#ec4899", "#eab308"];

/**
 * 十一环节决策闭环 · 环形图
 * 节点按决策顺序顺时针排列，环形箭头表达"宏观 → 决策 → 复盘 → 再出发"的闭环。
 * 节点颜色按阶段分色；中心为体系标识。
 */
export default function FlowCycle({ title = "十一环节决策闭环" }: { title?: string }) {
  const cx = 340;
  const cy = 265;
  const rOuter = 205; // 节点圆周
  const rInner = 150; // 内环装饰
  const n = DECISION_FLOW.length;

  const nodes = DECISION_FLOW.map((f, i) => {
    const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
    const x = cx + rOuter * Math.cos(angle);
    const y = cy + rOuter * Math.sin(angle);
    const color = STAGE_COLORS[f.stage - 1];
    return { ...f, x, y, color };
  });

  // 环形箭头：沿圆周的弧形虚线 + 箭头
  const arcPath = `M ${cx - rOuter} ${cy} A ${rOuter} ${rOuter} 0 1 1 ${cx + rOuter - 0.01} ${cy}`;

  return (
    <figure className="rounded-xl border border-border bg-card p-4">
      <svg viewBox="0 0 680 530" className="w-full h-auto" role="img" aria-label={title}>
        {/* 内环装饰 */}
        <circle cx={cx} cy={cy} r={rInner} fill="none" stroke="var(--border)" strokeWidth={1} strokeDasharray="4 4" opacity={0.6} />
        <circle cx={cx} cy={cy} r={rInner - 14} fill="var(--card)" stroke="none" />
        {/* 中心标识 */}
        <text x={cx} y={cy - 18} textAnchor="middle" fontSize={22} fontWeight={800} fill="var(--foreground)">GMRDS</text>
        <text x={cx} y={cy + 6} textAnchor="middle" fontSize={11} fill="var(--muted)">决策闭环 · 十一环节</text>
        <text x={cx} y={cy + 26} textAnchor="middle" fontSize={9.5} fill="var(--muted)">宏观 → 决策 → 复盘 → 再出发</text>

        {/* 环形箭头（顺时针闭环） */}
        <path d={arcPath} fill="none" stroke="var(--primary)" strokeWidth={1.6} strokeDasharray="1 7" strokeLinecap="round" opacity={0.55} />
        <polygon points={`${cx + rOuter - 12},${cy - 6} ${cx + rOuter + 2},${cy} ${cx + rOuter - 12},${cy + 6}`} fill="var(--primary)" opacity={0.8} />

        {/* 节点连线（圆心 → 节点） */}
        {nodes.map((nd) => (
          <line key={`ln-${nd.no}`} x1={cx} y1={cy} x2={nd.x} y2={nd.y} stroke={nd.color} strokeWidth={1} opacity={0.18} />
        ))}

        {/* 节点 */}
        {nodes.map((nd) => {
          const leftSide = nd.x < cx;
          const labelX = nd.x + (leftSide ? -54 : 54);
          const anchor = leftSide ? "end" : "start";
          return (
            <g key={nd.no}>
              <circle cx={nd.x} cy={nd.y} r={21} fill={nd.color} opacity={0.12} />
              <circle cx={nd.x} cy={nd.y} r={16} fill={nd.color} />
              <text x={nd.x} y={nd.y + 4.5} textAnchor="middle" fontSize={12} fontWeight={800} fill="#fff">{nd.no}</text>
              <text x={labelX} y={nd.y - 2} textAnchor={anchor} fontSize={11.5} fontWeight={600} fill="var(--foreground)">{nd.title}</text>
              <text x={labelX} y={nd.y + 11} textAnchor={anchor} fontSize={9} fill="var(--muted)">{nd.output}</text>
            </g>
          );
        })}

        {/* 阶段图例 */}
        <g fontSize={9.5} fill="var(--muted)">
          {STAGE_COLORS.map((c, i) => (
            <g key={c} transform={`translate(${20 + i * 165}, 508)`}>
              <rect x={0} y={-7} width={9} height={9} rx={2} fill={c} />
              <text x={14} y={0}>{["阶段1 宏观", "阶段2 资产行业", "阶段3 标的", "阶段4 执行优化"][i]}</text>
            </g>
          ))}
        </g>
      </svg>
      <figcaption className="text-[11px] text-muted mt-2 leading-relaxed">
        <b className="text-foreground">{title}：</b>节点按决策顺序顺时针流转，颜色对应四大阶段；
        中心为体系标识，环形箭头表示「宏观 → 决策 → 复盘 → 再出发」的持续闭环。节点标签为环节输出物。
      </figcaption>
    </figure>
  );
}
