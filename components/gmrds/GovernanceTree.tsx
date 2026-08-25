import { GOVERNANCE } from "@/lib/data/gmrds-deep";
import { FLOW_STAGES } from "@/lib/data/gmrds";

const STAGE_COLORS = ["#0ea5e9", "#10b981", "#ec4899", "#eab308"];
const COMMITTEE_COLOR = "#c8102e";

/**
 * 双层级治理架构 · 树状图
 * 决策委员会（统筹）→ 四大阶段 → 十二学院；虚线区分层级边界。
 */
export default function GovernanceTree() {
  const academies = GOVERNANCE.filter((g) => g.kind === "academy");
  const committee = GOVERNANCE.find((g) => g.kind === "committee")!;

  const colW = 150;
  const colGap = 16;
  const left = 30;
  const cols = FLOW_STAGES.map((s, i) => ({
    stage: s,
    units: academies.filter((a) => a.stage === s.no),
    x: left + i * (colW + colGap),
    color: STAGE_COLORS[i],
  }));

  const headerY = 40; // 委员会
  const stageY = 132; // 阶段标题
  const unitY0 = 172; // 学院起始
  const unitH = 86;
  const unitGap = 12;
  const width = left * 2 + 4 * colW + 3 * colGap;
  const height = unitY0 + 3 * (unitH + unitGap) + 40;

  return (
    <figure className="rounded-xl border border-border bg-card p-4 overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} style={{ minWidth: 640 }} className="w-full h-auto" role="img" aria-label="双层级治理架构图">
        {/* 决策委员会 */}
        <rect x={width / 2 - 110} y={headerY - 18} width={220} height={56} rx={10} fill={COMMITTEE_COLOR} />
        <text x={width / 2} y={headerY + 6} textAnchor="middle" fontSize={15} fontWeight={800} fill="#fff">决策委员会 C01</text>
        <text x={width / 2} y={headerY + 24} textAnchor="middle" fontSize={9.5} fill="rgba(255,255,255,0.85)">唯一统筹机构 · 汇总信号 → 交叉验证 → 最终决策 → 复盘</text>

        {/* 委员会 → 各阶段连线 */}
        {cols.map((c) => (
          <line key={`cl-${c.stage.no}`} x1={width / 2} y1={headerY + 38} x2={c.x + colW / 2} y2={stageY - 2} stroke={c.color} strokeWidth={1.4} opacity={0.5} />
        ))}

        {/* 阶段标题 */}
        {cols.map((c) => (
          <g key={c.stage.no}>
            <rect x={c.x} y={stageY - 14} width={colW} height={28} rx={8} fill={c.color} opacity={0.14} />
            <text x={c.x + colW / 2} y={stageY + 4} textAnchor="middle" fontSize={12} fontWeight={800} fill={c.color}>
              阶段 {c.stage.no} · {c.stage.label}
            </text>
          </g>
        ))}

        {/* 学院方块 */}
        {cols.map((c) =>
          c.units.map((u, i) => {
            const y = unitY0 + i * (unitH + unitGap);
            return (
              <g key={u.no}>
                <rect x={c.x} y={y} width={colW} height={unitH} rx={8} fill="var(--card)" stroke={c.color} strokeWidth={1.2} strokeOpacity={0.5} />
                <text x={c.x + colW / 2} y={y + 20} textAnchor="middle" fontSize={9} fontWeight={700} fill={c.color}>{u.no}</text>
                <text x={c.x + colW / 2} y={y + 38} textAnchor="middle" fontSize={11.5} fontWeight={700} fill="var(--foreground)">{u.name}</text>
                <text x={c.x + 8} y={y + 56} fontSize={8.5} fill="var(--muted)">
                  <tspan x={c.x + colW / 2} textAnchor="middle">{u.flowNos.length ? `环节 ${u.flowNos.join("/")}` : "数据底座"}</tspan>
                </text>
                <text x={c.x + colW / 2} y={y + unitH - 10} textAnchor="middle" fontSize={8} fill="var(--muted)" opacity={0.75}>
                  {u.flowNos.length ? `${u.flowNos.length} 个环节 · 输入→输出` : "全局数据服务"}
                </text>
              </g>
            );
          })
        )}

        {/* 层级标注 */}
        <text x={width - 10} y={headerY + 6} textAnchor="end" fontSize={9} fill="var(--muted)">层级一 · 统筹</text>
        <text x={width - 10} y={height - 12} textAnchor="end" fontSize={9} fill="var(--muted)">层级二 · 十二学院（职责分离，无最终裁量权）</text>
      </svg>
      <figcaption className="text-[11px] text-muted mt-2 leading-relaxed">
        <b className="text-foreground">双层级治理架构：</b>决策委员会为唯一统筹层（汇总 11 环节信号、交叉验证、输出最终决策）；
        十二学院按四大阶段分组承担研究职责，学院间以数据为纽带协作、边界清晰；颜色对应阶段（蓝=宏观 / 绿=资产行业 / 粉=标的 / 黄=执行优化）。
      </figcaption>
    </figure>
  );
}
