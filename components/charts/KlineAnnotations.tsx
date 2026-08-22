"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { echarts } from "./echarts";

export type AnnotationTool = "trend" | "hline" | "vline" | "channel" | "rect" | "ray" | "select";

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
}

const TOOL_COLORS: Record<Exclude<AnnotationTool, "select">, string> = {
  trend: "#3b82f6",
  hline: "#dc2626",
  vline: "#16a34a",
  channel: "#f59e0b",
  rect: "#8b5cf6",
  ray: "#0ea5e9",
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
export default function KlineAnnotations({ chart, activeTool, annotations, onChange, defaultStyle, bars, snapToHighLow }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [draft, setDraft] = useState<Annotation | null>(null); // 正在绘制的标注
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{ id: string; pointIdx: number } | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [version, setVersion] = useState(0); // 强制重绘

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

  // 父组件触发重绘（dataZoom 后）
  useEffect(() => {
    setVersion((v) => v + 1);
  }, [chart]);

  /** 取指针（鼠标/触摸）在 SVG 内的像素坐标 */
  const pointerPos = (e: React.PointerEvent<SVGSVGElement> | React.PointerEvent<SVGCircleElement>) => {
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
      // 选择模式：命中标注则选中并阻止冒泡（避免触发图表平移）；空白处放行（图表手势可用）
      const hit = hitTest(px, py);
      if (hit) {
        e.stopPropagation();
        setSelectedId(hit);
      } else {
        setSelectedId(null);
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
        if (prev.tool === "trend" || prev.tool === "channel" || prev.tool === "rect" || prev.tool === "ray") {
          return { ...prev, points: [prev.points[0], snap] };
        }
        if (prev.tool === "hline") return { ...prev, points: [prev.points[0], { ...snap, y: prev.points[0].y }] };
        if (prev.tool === "vline") return { ...prev, points: [prev.points[0], { x: prev.points[0].x, y: snap.y }] };
        return prev;
      });
      return;
    }

    // hover 检测
    const hit = hitTest(px, py);
    setHoverId(hit);
  };

  const onPointerUp = () => {
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
    // 水平线/垂直线/矩形需要两点的 x 或 y 差异
    if (a.tool === "hline" || a.tool === "vline") return true;
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
    <div className="relative">
      <svg
        ref={svgRef}
        className="absolute inset-0 z-10 kline-ann-svg"
        style={{ touchAction: "none", cursor: activeTool === "select" ? "default" : "crosshair" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => setHoverId(null)}
        onDoubleClick={onDoubleClick}
      >
        {all.map((a) => (
          <g key={a.id} data-annotation={a.id}>
            {renderAnnotation(a, a.id === draft?.id)}
            {renderHandles(a)}
          </g>
        ))}
      </svg>
    </div>
  );
}
