"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { echarts } from "./echarts";

export type AnnotationTool = "trend" | "hline" | "vline" | "channel" | "rect" | "ray" | "fib" | "select";

/** 线型样式 */
export type DashType = "solid" | "dash" | "dot";

export interface AnnotationStyle {
  color: string;
  dash: DashType;
  width: number;
}

export interface Annotation {
  id: string;
  tool: Exclude<AnnotationTool, "select">;
  /** 数据坐标点（x = category 索引, y = 价格） */
  points: Array<{ x: number; y: number }>;
  /** 样式 */
  color: string;
  /** 线型/线宽（样式配置面板设置） */
  style?: { dash: DashType; width: number };
  label?: string;
}

interface Props {
  /** ECharts 实例（从 EChart chartRef 获取） */
  chart: echarts.ECharts | null;
  activeTool: AnnotationTool;
  annotations: Annotation[];
  onChange: (list: Annotation[]) => void;
  /** 创建时使用的默认样式（颜色/线型/线宽） */
  defaultStyle?: AnnotationStyle;
  /** 吸附用 K 线数据（开启吸附时端点贴近最高/最低价） */
  bars?: Array<{ high: number; low: number }>;
  /** 是否开启端点吸附（贴近 K 线最高/最低价） */
  snapToHighLow?: boolean;
  /** 选中标注变化回调（供样式面板"应用到选中"等使用） */
  onSelectChange?: (id: string | null) => void;
}

const TOOL_COLORS: Record<Exclude<AnnotationTool, "select">, string> = {
  trend: "#3b82f6",
  hline: "#dc2626",
  vline: "#16a34a",
  channel: "#f59e0b",
  rect: "#8b5cf6",
  ray: "#0ea5e9",
  fib: "#e11d48",
};

/** 生成唯一 id（SSR 安全：模块级计数器，服务端与客户端一致） */
let _uid = 0;
const uid = () => `ann-${++_uid}`;

/**
 * K 线画线标注覆盖层（SVG）
 * - 创建：选择工具后拖拽绘制
 * - 编辑：选中标注后拖动端点
 * - 删除：选中后按 Delete/Backspace 或双击
 * - 坐标映射：chart.convertFromPixel/convertToPixel，dataZoom 缩放平移后由父组件触发重绘
 */
export default function KlineAnnotations({ chart, activeTool, annotations, onChange, defaultStyle, bars, snapToHighLow, onSelectChange }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [draft, setDraft] = useState<Annotation | null>(null); // 正在绘制的标注
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{ id: string; pointIdx: number } | null>(null);
  // 整体移动：记录起始指针数据坐标 + 起始点集，按差值平移所有点
  const [moving, setMoving] = useState<{ id: string; sx: number; sy: number; pts: Array<{ x: number; y: number }> } | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [version, setVersion] = useState(0); // 强制重绘
  // 图表平移（select 模式空白拖拽 → dispatchAction dataZoom；svg 与 ECharts 为兄弟节点，事件不再依赖冒泡）
  const panRef = useRef<{ px: number; start: number; end: number } | null>(null);

  /** 当前 dataZoom 可视区间（百分比） */
  const getZoomRange = useCallback((): { start: number; end: number } => {
    if (!chart) return { start: 0, end: 100 };
    try {
      const dz = (chart.getOption() as any)?.dataZoom?.[0] || {};
      return { start: Number(dz.start ?? 0), end: Number(dz.end ?? 100) };
    } catch {
      return { start: 0, end: 100 };
    }
  }, [chart]);

  /** K 线绘制区宽度（容器宽 - grid 左右留白） */
  const getPlotLeft = useCallback((): number => {
    if (!chart) return 56;
    try {
      const g = (chart.getOption() as any)?.grid?.[0] || {};
      return typeof g.left === "number" ? g.left : 56;
    } catch {
      return 56;
    }
  }, [chart]);

  const getPlotWidth = useCallback((): number => {
    if (!chart) return 600;
    try {
      const opt = chart.getOption() as any;
      const g = opt?.grid?.[0] || {};
      const w = chart.getWidth();
      const left = typeof g.left === "number" ? g.left : 56;
      const right = typeof g.right === "number" ? g.right : 14;
      return Math.max(80, w - left - right);
    } catch {
      return 600;
    }
  }, [chart]);

  /** 滚轮缩放（锚点跟随鼠标位置）——原生事件（React onWheel 为 passive，preventDefault 无效导致页面滚动冲突） */
  const zoomByWheel = useCallback(
    (e: WheelEvent) => {
      if (!chart || !svgRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      const { px } = pointerPos(e);
      const { start, end } = getZoomRange();
      const span = end - start;
      const factor = e.deltaY < 0 ? 0.82 : 1.2; // 上滚放大 / 下滚缩小
      const newSpan = Math.min(100, Math.max(6, span * factor));
      const plotW = getPlotWidth();
      const plotLeft = getPlotLeft();
      // 鼠标位置对应可视区间内的偏移比例保持（锚点不动）
      const ratio = Math.min(1, Math.max(0, (px - plotLeft) / plotW));
      const anchorOffset = span * ratio;
      let newStart = start + anchorOffset - newSpan * ratio;
      newStart = Math.min(100 - newSpan, Math.max(0, newStart));
      chart.dispatchAction({ type: "dataZoom", dataZoomIndex: 0, start: newStart, end: newStart + newSpan });
      // ECharts 6 的 dispatchAction 只更新内部状态不强制重绘（canvas 不刷新），手动刷新渲染层
      try {
        (chart as any).getZr()?.refresh();
      } catch {
        /* ignore */
      }
      setVersion((v) => v + 1);
    },
    [chart, getZoomRange, getPlotWidth, getPlotLeft]
  );

  // 原生 wheel 监听（passive:false → preventDefault 生效，滚轮缩放时页面不滚动）
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    el.addEventListener("wheel", zoomByWheel, { passive: false });
    return () => el.removeEventListener("wheel", zoomByWheel);
  }, [zoomByWheel]);

  /** 选中变化对外通知 */
  useEffect(() => {
    onSelectChange?.(selectedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  /** 吸附：把数据坐标的 y 贴近最近 K 线最高/最低价（x 取整到 K 线中心） */
  const snapPoint = useCallback(
    (d: { x: number; y: number }) => {
      if (!snapToHighLow || !bars?.length) return d;
      const idx = Math.round(d.x);
      if (idx < 0 || idx >= bars.length) return d;
      const bar = bars[idx];
      if (bar == null || !isFinite(bar.high) || !isFinite(bar.low)) return d;
      const distHigh = Math.abs(d.y - bar.high);
      const distLow = Math.abs(d.y - bar.low);
      return { x: idx, y: distHigh <= distLow ? bar.high : bar.low };
    },
    [snapToHighLow, bars]
  );

  /** 鼠标像素坐标 → 数据坐标（基于主图 grid[0]） */
  const toData = useCallback(
    (px: number, py: number) => {
      if (!chart) return null;
      try {
        const pt = chart.convertFromPixel({ seriesIndex: 0 }, [px, py]);
        if (!pt || !Array.isArray(pt)) return null;
        return { x: pt[0], y: pt[1] };
      } catch {
        return null;
      }
    },
    [chart]
  );

  /** 数据坐标 → SVG 像素坐标 */
  const toPixel = useCallback(
    (d: { x: number; y: number }) => {
      if (!chart) return { x: 0, y: 0 };
      try {
        const pt = chart.convertToPixel({ seriesIndex: 0 }, [d.x, d.y]);
        return { x: pt[0], y: pt[1] };
      } catch {
        return { x: 0, y: 0 };
      }
    },
    [chart]
  );

  // 缩放/平移后重绘（datazoom 事件触发；toPixel 基于 convertToPixel 动态计算，重绘即更新位置）
  useEffect(() => {
    if (!chart || typeof (chart as any).isDisposed === "function" && (chart as any).isDisposed()) return;
    const onZoom = () => setVersion((v) => v + 1);
    chart.on("datazoom", onZoom);
    return () => {
      try {
        if (!(chart as any).isDisposed?.()) chart.off("datazoom", onZoom);
      } catch {
        /* 已 dispose，忽略 */
      }
    };
  }, [chart]);

  // chart 就绪时重绘一次
  useEffect(() => {
    setVersion((v) => v + 1);
  }, [chart]);

  /** 取指针（鼠标/触摸）在 SVG 内的像素坐标（支持 pointer / wheel 事件） */
  const pointerPos = (e: { clientX: number; clientY: number }) => {
    if (!svgRef.current) return { px: 0, py: 0 };
    const rect = svgRef.current.getBoundingClientRect();
    return { px: e.clientX - rect.left, py: e.clientY - rect.top };
  };

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!chart || !svgRef.current) return;
    // 捕获指针：绘制/拖动期间指针移出 SVG 仍能收到 move/up（触摸设备必需）
    try {
      svgRef.current.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    const { px, py } = pointerPos(e);
    const d = toData(px, py);
    if (!d) return;

    if (activeTool === "select") {
      // 选择模式：命中标注则选中并开始整体移动（按住拖动）；空白处 → 拖拽平移图表
      const hit = hitTest(px, py);
      if (hit) {
        e.stopPropagation();
        setSelectedId(hit);
        const target = annotations.find((a) => a.id === hit);
        if (target) {
          setMoving({ id: hit, sx: d.x, sy: d.y, pts: target.points.map((p) => ({ x: p.x, y: p.y })) });
        }
      } else {
        setSelectedId(null);
        // 空白拖拽 = 平移 K 线（事件桥接：dispatchAction dataZoom）
        const { start, end } = getZoomRange();
        panRef.current = { px, start, end };
      }
      return;
    }

    // 创建模式：阻止事件冒泡，避免图表同时平移/缩放；开始草稿
    e.stopPropagation();
    e.preventDefault();
    const tool = activeTool;
    const snap = snapPoint(d);
    setDraft({
      id: uid(),
      tool,
      points: [snap],
      color: defaultStyle?.color ?? TOOL_COLORS[tool],
      style: { dash: defaultStyle?.dash ?? "solid", width: defaultStyle?.width ?? 1.4 },
    });
    setSelectedId(null);
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const { px, py } = pointerPos(e);

    // 空白拖拽平移图表（select 模式）
    if (panRef.current && chart) {
      e.stopPropagation();
      const p = panRef.current;
      const plotW = getPlotWidth();
      const span = p.end - p.start;
      const shift = ((p.px - px) / Math.max(50, plotW)) * span;
      const newStart = Math.min(100 - span, Math.max(0, p.start + shift));
      chart.dispatchAction({ type: "dataZoom", dataZoomIndex: 0, start: newStart, end: newStart + span });
      try {
        (chart as any).getZr()?.refresh();
      } catch {
        /* ignore */
      }
      setVersion((v) => v + 1);
      return;
    }

    // 整体移动已选标注
    if (moving && chart) {
      e.stopPropagation();
      const d = toData(px, py);
      if (!d) return;
      const dx = d.x - moving.sx;
      const dy = d.y - moving.sy;
      setAnnotations((list) =>
        list.map((a) =>
          a.id === moving.id ? { ...a, points: moving.pts.map((p) => ({ x: p.x + dx, y: p.y + dy })) } : a
        )
      );
      return;
    }

    // 拖拽已有标注端点
    if (dragging && chart) {
      e.stopPropagation();
      const d = toData(px, py);
      if (!d) return;
      const snap = snapPoint(d);
      setAnnotations((list) =>
        list.map((a) =>
          a.id === dragging.id
            ? { ...a, points: a.points.map((p, i) => (i === dragging.pointIdx ? snap : p)) }
            : a
        )
      );
      return;
    }

    // 更新草稿
    if (draft && chart) {
      e.stopPropagation();
      const d = toData(px, py);
      if (!d) return;
      const snap = snapPoint(d);
      setDraft((prev) => {
        if (!prev) return prev;
        if (prev.tool === "trend" || prev.tool === "channel" || prev.tool === "rect" || prev.tool === "ray" || prev.tool === "fib") {
          return { ...prev, points: [prev.points[0], snap] };
        }
        if (prev.tool === "hline") return { ...prev, points: [prev.points[0], { ...snap, y: prev.points[0].y }] };
        if (prev.tool === "vline") return { ...prev, points: [prev.points[0], { x: prev.points[0].x, y: snap.y }] };
        return prev;
      });
      return;
    }

    // hover 检测 + tooltip 转发（svg 捕获事件时 ECharts 收不到 hover，用 showTip 桥接）
    const hit = hitTest(px, py);
    setHoverId(hit);
    if (chart && !(chart as any).isDisposed?.()) {
      try {
        const d = toData(px, py);
        if (d && Number.isFinite(d.x)) {
          chart.dispatchAction({ type: "showTip", seriesIndex: 0, dataIndex: Math.round(d.x) });
        }
      } catch {
        /* ignore */
      }
    }
  };

  const onPointerUp = () => {
    if (panRef.current) {
      panRef.current = null;
      return;
    }
    if (moving) {
      setMoving(null);
      return;
    }
    if (dragging) {
      setDragging(null);
      return;
    }
    if (draft) {
      const d = { ...draft };
      setDraft(null);
      if (d.points.length >= 2 && isValid(d)) {
        onChange([...annotations, d]);
      }
    }
  };

  const isValid = (a: Annotation) => {
    if (a.points.length < 2) return false;
    const [p0, p1] = a.points;
    // 水平线/垂直线/斐波那契需要两点的 x 或 y 差异
    if (a.tool === "hline" || a.tool === "vline") return true;
    if (a.tool === "fib") return Math.abs(p1.y - p0.y) > 0.5;
    const dx = Math.abs(p1.x - p0.x);
    const dy = Math.abs(p1.y - p0.y);
    return a.tool === "rect" ? dx > 0.5 && dy > 0.5 : dx > 0.5 || dy > 0.5;
  };

  const hitTest = (px: number, py: number): string | null => {
    for (const a of [...annotations, ...(draft ? [draft] : [])].reverse()) {
      if (a.points.length < 2) continue;
      const pts = a.points.map(toPixel);
      if (a.tool === "rect") {
        const [p0, p1] = pts;
        const [x0, x1] = [Math.min(p0.x, p1.x), Math.max(p0.x, p1.x)];
        const [y0, y1] = [Math.min(p0.y, p1.y), Math.max(p0.y, p1.y)];
        if (px >= x0 - 5 && px <= x1 + 5 && py >= y0 - 5 && py <= y1 + 5) return a.id;
      } else if (a.tool === "hline") {
        const p = pts[0];
        if (Math.abs(py - p.y) <= 6) return a.id;
      } else if (a.tool === "vline") {
        const p = pts[0];
        if (Math.abs(px - p.x) <= 6) return a.id;
      } else if (a.tool === "fib") {
        // 斐波那契：命中任意一条水平回撤线
        const [p0, p1] = pts;
        const levels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
        for (const lv of levels) {
          const y = p0.y + (p1.y - p0.y) * lv;
          if (Math.abs(py - y) <= 6) return a.id;
        }
      } else {
        // 趋势线/通道线：线段距离；射线：点到射线距离
        const [p0, p1] = pts;
        if (a.tool === "ray") {
          if (distToRay(px, py, p0, p1) <= 6) return a.id;
        } else if (distToSegment(px, py, p0, p1) <= 6) return a.id;
      }
    }
    return null;
  };

  const distToSegment = (px: number, py: number, a: { x: number; y: number }, b: { x: number; y: number }) => {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    if (dx === 0 && dy === 0) return Math.hypot(px - a.x, py - a.y);
    const t = Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(px - (a.x + t * dx), py - (a.y + t * dy));
  };

  /** 点到射线（起点 a，方向经 b 延伸）的距离 */
  const distToRay = (px: number, py: number, a: { x: number; y: number }, b: { x: number; y: number }) => {
    const vx = b.x - a.x;
    const vy = b.y - a.y;
    const len2 = vx * vx + vy * vy;
    if (len2 < 1e-9) return Math.hypot(px - a.x, py - a.y);
    const t = ((px - a.x) * vx + (py - a.y) * vy) / len2;
    if (t < 0) return Math.hypot(px - a.x, py - a.y); // 在起点反向，取起点距离
    return Math.abs((px - a.x) * vy - (py - a.y) * vx) / Math.sqrt(len2);
  };

  const setAnnotations = (fn: (list: Annotation[]) => Annotation[]) => {
    onChange(fn([...annotations]));
  };

  // 键盘删除
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        onChange(annotations.filter((a) => a.id !== selectedId));
        setSelectedId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, annotations]);

  // 双击删除
  const onDoubleClick = () => {
    if (selectedId) {
      onChange(annotations.filter((a) => a.id !== selectedId));
      setSelectedId(null);
    }
  };

  // 渲染单个标注
  const renderAnnotation = (a: Annotation, isDraft: boolean) => {
    if (a.points.length < 1) return null;
    const pts = a.points.map(toPixel);
    const isSel = selectedId === a.id;
    const isHover = hoverId === a.id;
    const stroke = isSel ? "#ffffff" : a.color;
    const baseW = a.style?.width ?? 1.4;
    const strokeW = (isSel || isHover ? baseW + 0.8 : baseW);
    const opacity = isSel ? 1 : 0.85;
    // 线型：实线 / 虚线 / 点线
    const dashMap: Record<DashType, string | undefined> = { solid: undefined, dash: "6 3", dot: "2 3" };
    const strokeDasharray = a.style?.dash ? dashMap[a.style.dash] : undefined;
    const common = {
      stroke,
      strokeWidth: strokeW,
      strokeDasharray,
      opacity,
      fill: "none",
      pointerEvents: "none" as const,
    };

    if (a.tool === "rect" && pts.length >= 2) {
      const [p0, p1] = pts;
      const x = Math.min(p0.x, p1.x);
      const y = Math.min(p0.y, p1.y);
      return <rect x={x} y={y} width={Math.abs(p1.x - p0.x)} height={Math.abs(p1.y - p0.y)} {...common} fill={isDraft ? `${a.color}18` : `${a.color}14`} />;
    }
    if (a.tool === "hline" && pts.length >= 1) {
      return <line x1={0} y1={pts[0].y} x2={10000} y2={pts[0].y} {...common} />;
    }
    if (a.tool === "vline" && pts.length >= 1) {
      return <line x1={pts[0].x} y1={0} x2={pts[0].x} y2={10000} {...common} />;
    }
    if (a.tool === "channel" && pts.length >= 2) {
      const [p0, p1] = pts;
      const dY = p1.y - p0.y;
      return (
        <>
          <line x1={p0.x} y1={p0.y} x2={p1.x} y2={p1.y} {...common} />
          <line x1={p0.x} y1={p0.y - dY} x2={p1.x} y2={p1.y - dY} {...common} />
        </>
      );
    }
    if (a.tool === "fib" && pts.length >= 2) {
      // 斐波那契回撤：0 / 0.236 / 0.382 / 0.5 / 0.618 / 0.786 / 1 七条水平线 + 价格标签
      const [p0, p1] = pts;
      const yData0 = a.points[0].y;
      const yData1 = a.points[1].y;
      const levels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
      return (
        <g>
          {/* 趋势方向线（两点连线） */}
          <line x1={p0.x} y1={p0.y} x2={p1.x} y2={p1.y} {...common} opacity={0.5} />
          {levels.map((lv) => {
            const y = p0.y + (p1.y - p0.y) * lv;
            const price = yData0 + (yData1 - yData0) * lv;
            return (
              <g key={lv}>
                <line
                  x1={0}
                  y1={y}
                  x2={10000}
                  y2={y}
                  stroke={a.color}
                  strokeWidth={1}
                  strokeDasharray="5 4"
                  opacity={isSel ? 0.95 : 0.55}
                  pointerEvents="none"
                />
                <text x={10070} y={y + 3} fontSize={9} fill={a.color} opacity={0.9} textAnchor="end" pointerEvents="none">
                  {lv === 0 ? "0%" : lv === 1 ? "100%" : `${(lv * 100).toFixed(1)}%`}　{price.toFixed(2)}
                </text>
              </g>
            );
          })}
        </g>
      );
    }
    if (a.tool === "ray" && pts.length >= 2) {
      // 射线：从 p0 出发经 p1 向同一方向无限延伸
      const [p0, p1] = pts;
      const dx = p1.x - p0.x;
      const dy = p1.y - p0.y;
      const len = Math.hypot(dx, dy);
      if (len < 1e-6) return null;
      const ext = 12000;
      return (
        <line
          x1={p0.x}
          y1={p0.y}
          x2={p0.x + (dx / len) * ext}
          y2={p0.y + (dy / len) * ext}
          {...common}
        />
      );
    }
    if (pts.length >= 2) {
      const [p0, p1] = pts;
      return <line x1={p0.x} y1={p0.y} x2={p1.x} y2={p1.y} {...common} />;
    }
    return null;
  };

  // 渲染端点（可拖动）
  const renderHandles = (a: Annotation) => {
    if (selectedId !== a.id && !dragging) return null;
    if (a.tool === "hline" || a.tool === "vline") {
      const p = toPixel(a.points[0]);
      return (
        <circle
          cx={p.x}
          cy={p.y}
          r={6}
          fill="#ffffff"
          stroke="#0f172a"
          strokeWidth={1.5}
          cursor="move"
          onPointerDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            setDragging({ id: a.id, pointIdx: 0 });
          }}
        />
      );
    }
    return a.points.map((p, i) => {
      const pt = toPixel(p);
      return (
        <circle
          key={i}
          cx={pt.x}
          cy={pt.y}
          r={6}
          fill="#ffffff"
          stroke="#0f172a"
          strokeWidth={1.5}
          cursor="move"
          onPointerDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            setDragging({ id: a.id, pointIdx: i });
          }}
        />
      );
    });
  };

  const all = [...(draft ? [draft] : []), ...annotations];

  return (
    // 关键：svg 直接覆盖在图表容器上（AnnotatableChart 提供 relative 容器），
    // 必须 absolute + w-full h-full 撑满，否则包装 div 高度塌陷为 0 → 画线层点不到
    <svg
      ref={svgRef}
      className="absolute left-0 top-0 w-full kline-ann-svg"
      style={{
        // 覆盖 K 线主图区（底部留 26px 给 dataZoom 滑块，滑块可拖拽/原生缩放）；wrapper 已 pointer-events-none 穿透
        height: "calc(100% - 26px)",
        pointerEvents: "auto",
        // 图表区域手势全部归图表（滚轮缩放/拖拽平移），页面滚动在图表外进行（避免手势冲突）
        touchAction: "none",
        cursor: activeTool === "select" ? "default" : "crosshair",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={() => {
        setHoverId(null);
        if (chart && !chart.isDisposed?.()) {
          try {
            chart.dispatchAction({ type: "hideTip" });
          } catch {
            /* ignore */
          }
        }
      }}
      onDoubleClick={onDoubleClick}
    >
      {all.map((a) => (
        <g key={a.id} data-annotation={a.id} style={{ pointerEvents: "visiblePainted" }}>
          {renderAnnotation(a, a.id === draft?.id)}
          {renderHandles(a)}
        </g>
      ))}
    </svg>
  );
}
