import type { EChartsOption } from "echarts";

/**
 * 统一 K 线悬停卡片工厂：
 * - position 跟随鼠标并偏移，避免卡片遮挡鼠标所在 K 线
 * - formatter 精简为最小必要信息（开高低收/涨跌/成交量）
 * - confine 防止溢出
 *
 * 关于「卡片停留太久」的三条设置（都是踩过才加的）：
 *
 * 1) **enterable: false** —— 这是主因。ECharts 5+ 默认 enterable=true，
 *    tooltip 的 DOM 会**捕获鼠标事件**。而 position 把卡片放在光标右下 14px，
 *    鼠标沿图移动时很容易滑到卡片上；一旦滑上去，图表就收不到 mousemove，
 *    卡片自己把自己"钉"住，直到指针移开很远才消失 —— 表现就是"停留时间太长"。
 *    关掉后指针永远穿透卡片，卡片只由图表上的位置决定去留。
 *
 * 2) **showDelay 从 300ms 降到 60ms** —— 300ms 的意图是"快速划过不弹窗"，
 *    但 ECharts 的 showDelay 同样作用于**内容更新**：在相邻两根 K 线之间移动时，
 *    卡片会先显示旧数据、延迟后才刷新，看起来像"卡住不动"。60ms 足够过滤快速扫过。
 *
 * 3) **hideDelay 40ms + transitionDuration 0.15s** —— 默认 hideDelay 100ms
 *    再叠加默认 0.4s 淡出动画，实际残留约半秒，拖泥带水。
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
    // 悬停卡片开关：由外部状态（控制条上的「悬停卡」）控制。
    // 关掉时 ECharts 连十字准星一起停 —— 这正是"不想被打扰"时要的效果。
    show: opts?.show ?? true,
    trigger: "axis",
    axisPointer: { type: "cross" },
    backgroundColor: "rgba(255,255,255,0.95)",
    borderColor: "#94a3b8",
    borderWidth: 1,
    padding: [8, 10],
    textStyle: { color: "#1e293b", fontSize: 12 },
    extraCssText: "box-shadow:0 4px 16px rgba(0,0,0,0.12);border-radius:8px;backdrop-filter:blur(4px)",
    confine: true,
    // 指针必须能穿透卡片，否则卡片会被自己"钉"住（详见文件头的说明）
    enterable: false,
    showDelay: 60,
    hideDelay: 40,
    transitionDuration: 0.15,
    // 跟随鼠标并偏移到右上方，不遮挡当前悬停 K 线
    position: (point: number[], params: any, dom: HTMLElement) => {
      const w = dom.offsetWidth || 160;
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
      // 修正：此前无论 position 传 "top" 还是 "bottom" 都写死 "top"，
      // 也就是说新加的「上方/下方」开关对 yOf 的锚点计算有效、对 label 自身无效，
      // 两者会打架（点在 low 下方的标注，文字仍浮在 high 上方）。
      position: position === "bottom" ? "bottom" : "top",
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
