/**
 * K 线图横轴（时间轴）构建帮助函数
 * 解决横轴显示不完整的三个根因：
 *  1. category 轴 boundaryGap:true 导致首尾各留半格 → 首尾刻度被挤出可视区
 *  2. 数据量大时 axisLabel 默认 auto 间隔 → 刻度稀疏或重叠
 *  3. 首尾标签可能被隐藏 → 时间轴无法确认覆盖起止
 */

export interface TimeAxisOptions {
  /** 数据量（用于自动计算刻度间隔） */
  dataLength: number;
  /** 日K / 月K / 年K，决定标签格式与间隔基准 */
  period: "day" | "month" | "year" | "week";
  /** 是否显示首尾标签（默认 true） */
  showBoundary?: boolean;
  /** 数据起始日期（YYYY-MM-DD，用于首尾确认） */
  firstDate?: string;
  /** 数据结束日期 */
  lastDate?: string;
  /** 网格索引（多轴联动用） */
  gridIndex?: number;
}

/** 计算合理刻度间隔：目标可视刻度约 6-8 个 */
function calcInterval(dataLength: number): number {
  if (dataLength <= 8) return 0; // 数据少全部显示
  if (dataLength <= 40) return 2;
  if (dataLength <= 120) return 5;
  if (dataLength <= 260) return 10;
  if (dataLength <= 600) return 20;
  if (dataLength <= 1300) return 40;
  if (dataLength <= 2600) return 60;
  if (dataLength <= 5200) return 90;
  return 120;
}

/**
 * 日K / 周K 的横轴标签：加年份，但最新那年不加。
 *
 * 为什么需要：K线跨度已经拉到 25 年（个股 6015 根 / 板块 6480 根），
 * 只显示 MM-DD 时，2003-03-15 和 2023-03-15 在轴上长得一模一样，分不清年月。
 * 但最新一年是「当下」，年份属于冗余信息，重复只会挤掉刻度间距。
 *
 * @param lastDate 数据区间的最后一天（yyyy-MM-dd），用于判定哪个是「最新那年」
 */
export function mkDayLabel(lastDate?: string | null) {
  const latestYear = lastDate ? lastDate.slice(0, 4) : null;
  return (v: string) => {
    const year = v.slice(0, 4);
    if (year === latestYear) return v.slice(5, 10); // 最新那年：只显示 MM-DD
    return `${year}-${v.slice(5, 10)}`;
  };
}

/**
 * 日K / 周K 的横轴标签配置（年份规则 + 首尾内对齐）。
 *
 * alignMinLabel/alignMaxLabel 是关键：带年份后标签从 5 字符变成 10 字符，
 * 首尾标签默认以刻度为中心绘制，会溢出网格压到 Y 轴刻度上（"1993-11-08" 糊在 "800" 上）。
 * 改成首标签靠左、尾标签靠右，两者都朝网格内侧展开，天然不越界。
 */
export function mkDayAxisLabel(lastDate?: string | null, extra?: Record<string, unknown>) {
  return {
    showMaxLabel: true,
    showMinLabel: true,
    hideOverlap: true,
    alignMinLabel: "left" as const,
    alignMaxLabel: "right" as const,
    formatter: mkDayLabel(lastDate),
    ...extra,
  };
}

/**
 * 构建主图 xAxis 配置（category 轴）
 * - boundaryGap:false：首尾 K 线贴边，刻度必然覆盖全部数据范围
 * - interval 按数据量自适应：避免刻度重叠（数据多间隔大）
 * - showMaxLabel/showMinLabel 强制首尾日期可见
 * - formatter 按周期裁剪日期长度（日/周K 显示 YYYY-MM-DD，月K 显示 YYYY-MM，年K 显示 YYYY）；
 *   日/周K 的最新一年省略年份（见 mkDayLabel）
 */
export function mkMainAxis(opts: TimeAxisOptions) {
  const { dataLength, period, gridIndex = 0, firstDate, lastDate } = opts;
  const dayLabel = mkDayLabel(lastDate);
  return {
    type: "category" as const,
    gridIndex,
    // 关键修复：false 使首尾数据贴轴边缘，配合 showMaxLabel 保证起止刻度完整显示
    boundaryGap: false,
    axisLabel: {
      fontSize: 10,
      interval: calcInterval(dataLength),
      ...mkDayAxisLabel(lastDate, {
        formatter:
          period === "month" ? (v: string) => v.slice(0, 7)
          : period === "year" ? (v: string) => v.slice(0, 4)
          : dayLabel,
      }),
    },
    // 首尾日期作为 axisPointer 参考（不渲染，仅内部确认）
    ...(firstDate && lastDate ? { _first: firstDate, _last: lastDate } : {}),
  };
}

/** 构建副图 xAxis（成交量/指标，隐藏标签） */
export function mkSubAxis(dataLength: number, gridIndex: number) {
  return {
    type: "category" as const,
    gridIndex,
    boundaryGap: false,
    axisLabel: { show: false },
  };
}

/** 构建 dataZoom：默认全量显示（start:0 end:100），缩放/平移不丢失任何时段 */
export function mkFullZoom(xAxisIndex: number[] | number, height = 16) {
  const idx = Array.isArray(xAxisIndex) ? xAxisIndex : [xAxisIndex];
  return [
    { type: "inside" as const, xAxisIndex: idx, start: 0, end: 100, zoomOnMouseWheel: true, moveOnMouseMove: true },
    { type: "slider" as const, xAxisIndex: idx, height, bottom: 4, start: 0, end: 100 },
  ];
}
