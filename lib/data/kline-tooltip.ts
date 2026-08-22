import type { EChartsOption } from "echarts";

/**
 * 统一 K 线悬停卡片工厂：
 * - position 跟随鼠标并偏移，避免卡片遮挡鼠标所在 K 线
 * - formatter 精简为最小必要信息（开高低收/涨跌/成交量）
 * - showDelay 300ms：快速滑动不弹窗，停留才显示
 * - confine 防止溢出
 */
export function mkKlineTooltip(opts?: {
  bars?: Array<{ date: string; open?: number; close: number; high?: number; low?: number; volume?: number }>;
  /** 是否允许用户切换显隐（由外部状态控制） */
  show?: boolean;
  /** 自定义 formatter（默认精简 OHLC） */
  formatter?: (params: any) => string;
}): EChartsOption["tooltip"] {
  const formatter = opts?.formatter ?? ((params: any) => {
    const arr = Array.isArray(params) ? params : [params];
    const i = arr[0]?.dataIndex ?? 0;
    const b = opts?.bars?.[i];
    if (!b) return "";
    const prev = i > 0 ? opts.bars![i - 1].close : (b.open ?? b.close);
    const pct = prev ? ((b.close - prev) / prev) * 100 : 0;
    const sign = pct >= 0 ? "+" : "";
    const vol = b.volume != null
      ? b.volume >= 1e8 ? `${(b.volume / 1e8).toFixed(2)}亿` : b.volume >= 1e4 ? `${(b.volume / 1e4).toFixed(1)}万` : `${b.volume}`
      : "—";
    const o = b.open?.toFixed(2) ?? "—";
    const h = b.high?.toFixed(2) ?? "—";
    const l = b.low?.toFixed(2) ?? "—";
    return `<div style="font-size:12px;line-height:1.7;min-width:120px">
      <b>${b.date}</b>
      <table style="margin-top:4px;border-collapse:collapse">
        <tr><td style="color:#888;padding-right:8px">开</td><td style="text-align:right;font-family:monospace">${o}</td></tr>
        <tr><td style="color:#888;padding-right:8px">高</td><td style="text-align:right;font-family:monospace">${h}</td></tr>
        <tr><td style="color:#888;padding-right:8px">低</td><td style="text-align:right;font-family:monospace">${l}</td></tr>
        <tr><td style="color:#888;padding-right:8px">收</td><td style="text-align:right;font-family:monospace"><span style="color:${pct >= 0 ? "#dc2626" : "#16a34a"};font-weight:bold">${b.close.toFixed(2)}</span> <span style="color:${pct >= 0 ? "#dc2626" : "#16a34a"};font-size:11px">${sign}${pct.toFixed(2)}%</span></td></tr>
        <tr><td style="color:#888;padding-right:8px">量</td><td style="text-align:right;font-family:monospace">${vol}</td></tr>
      </table>
    </div>`;
  });

  return {
    trigger: "axis",
    axisPointer: { type: "cross" },
    backgroundColor: "rgba(255,255,255,0.95)",
    borderColor: "#94a3b8",
    borderWidth: 1,
    padding: [8, 10],
    textStyle: { color: "#1e293b", fontSize: 12 },
    extraCssText: "box-shadow:0 4px 16px rgba(0,0,0,0.12);border-radius:8px;backdrop-filter:blur(4px)",
    confine: true,
    showDelay: 300,
    hideDelay: 100,
    // 跟随鼠标并偏移到右上方，不遮挡当前悬停 K 线
    position: (point: number[], params: any, dom: HTMLElement) => {
      const w = dom.offsetWidth || 160;
      const h = dom.offsetHeight || 140;
      const winW = typeof window !== "undefined" ? window.innerWidth : 1200;
      const left = point[0] + 14;
      const fitLeft = left + w > winW - 8 ? Math.max(8, point[0] - w - 14) : left;
      const top = point[1] + 14;
      return [fitLeft, top];
    },
    formatter,
  } as any;
}

/** K 线图通用浮层提示样式（深色主题适配） */
export const klineTooltipDark = {
  backgroundColor: "rgba(15,23,42,0.95)",
  borderColor: "#475569",
  textStyle: { color: "#e2e8f0" },
};

/* ------------------------------------------------------------------ */
/* 逐根 K 线涨跌幅标注（功能一）                                        */
/* ------------------------------------------------------------------ */

export interface PctLabelConfig {
  /** 每根 K 线相对前一根的涨跌幅 */
  bars: Array<{ date?: string; open?: number; close: number; high?: number; low?: number }>;
  /** 是否显示（显隐开关） */
  show: boolean;
  /** 标注位置：K 线顶部（上方）或底部（下方） */
  position?: "top" | "bottom";
  /** 字体大小 */
  fontSize?: number;
  /** 数据超过该数量时只标注最近 keep 根（初始未缩放时的性能保护） */
  maxVisible?: number;
  keep?: number;
  /** 当前 dataZoom 可视范围（百分比 0-100），缩放时只标注可视区内的 K 线（不遗漏任何一根） */
  pctRange?: [number, number] | null;
}

/**
 * 生成「涨跌幅标注」scatter 叠加 series（不遗漏任何一根）：
 * - 注意：ECharts candlestick 的 label 配置实测不渲染（SSR 验证），因此用透明 scatter 点 + label 实现
 * - 涨红跌绿（中国习惯）；基于当日收盘 ÷ 前一交易日收盘
 * - 缩放联动：提供 pctRange 时只标注可视范围内的 K 线（全标该范围）；
 *   未缩放且数据超 maxVisible 时仅标注最近 keep 根（8190 根日K 初始全标会糊）
 */
export function mkPctSeries(cfg: PctLabelConfig) {
  const { bars, show, position = "top", fontSize = 9, maxVisible = 60, keep = 60, pctRange } = cfg;
  const pctOf = (i: number) => {
    if (i < 0 || i >= bars.length) return 0;
    const b = bars[i];
    const prev = i > 0 ? bars[i - 1].close : (b.open ?? b.close);
    if (!prev || !isFinite(prev)) return 0;
    return ((b.close - prev) / prev) * 100;
  };
  const inView = (i: number) => {
    if (pctRange) {
      const [s, e] = pctRange;
      const si = Math.floor((s / 100) * bars.length);
      const ei = Math.ceil((e / 100) * bars.length);
      return i >= si && i <= ei;
    }
    if (bars.length > maxVisible && i < bars.length - keep) return false; // 未缩放时只标最近 keep 根（防重叠）
    return true;
  };
  // 标注锚点 y：上方 = high 上方，下方 = low 下方
  const yOf = (i: number) => {
    const b = bars[i];
    if (!b) return 0;
    if (position === "bottom" && b.low != null) return b.low * (1 - 0.006);
    const h = b.high ?? b.close;
    return h * (1 + 0.006);
  };
  return {
    name: "涨跌幅",
    type: "scatter" as const,
    xAxisIndex: 0,
    yAxisIndex: 0,
    symbolSize: 0,
    silent: true,
    z: 5,
    tooltip: { show: false },
    emphasis: { disabled: true },
    // x 用 category 值（日期/年份），与 K 线 category 轴精确对齐（数字索引在 dataZoom 下有偏移风险）
    data: bars.map((b, i) => [b.date ?? i, yOf(i)]),
    label: {
      show,
      position: "top" as const,
      fontSize,
      distance: 1,
      formatter: (p: any) => {
        const i = p?.dataIndex ?? 0;
        if (!inView(i)) return "";
        const pct = pctOf(i);
        if (!pct) return "";
        return `${pct > 0 ? "+" : ""}${pct.toFixed(2)}%`;
      },
      color: (p: any) => {
        const i = p?.dataIndex ?? 0;
        return pctOf(i) >= 0 ? "#dc2626" : "#16a34a";
      },
    },
    // 宽松类型（scatter 类型联合过窄，运行时行为一致）
  } as any;
}

/** 兼容别名：旧名 mkPctLabel 现指向 series 版（避免调用处混淆） */
export const mkPctLabel = mkPctSeries;
