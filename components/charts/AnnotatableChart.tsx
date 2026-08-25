"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { echarts, type EChartsOption } from "./echarts";
import EChart from "./EChart";
import KlineAnnotations, { type Annotation, type AnnotationStyle, type AnnotationTool, type DashType } from "./KlineAnnotations";

const TOOLS: Array<{ key: AnnotationTool; label: string; title: string }> = [
  { key: "select", label: "⛏ 选择", title: "选择/编辑标注（拖动移动、拖端点调角度、Del 删除）" },
  { key: "trend", label: "↗ 趋势线", title: "绘制趋势线（拖出两个端点）" },
  { key: "hline", label: "─ 水平线", title: "绘制水平线（支撑/压力）" },
  { key: "vline", label: "│ 垂直线", title: "绘制垂直线（时间标记）" },
  { key: "ray", label: "➘ 射线", title: "绘制射线（从起点向一端无限延伸）" },
  { key: "fib", label: "◆ 斐波那契", title: "绘制斐波那契回撤线（0-100% 七档）" },
  { key: "channel", label: "≡ 通道线", title: "绘制平行通道" },
  { key: "rect", label: "▭ 矩形", title: "绘制矩形区域" },
];

const PEN_COLORS = ["#3b82f6", "#dc2626", "#16a34a", "#f59e0b", "#8b5cf6", "#0ea5e9", "#64748b", "#e11d48"];
const PEN_DASHES: Array<{ key: DashType; label: string }> = [
  { key: "solid", label: "—" },
  { key: "dash", label: "┅" },
  { key: "dot", label: "…" },
];
const PEN_WIDTHS = [1, 1.5, 2, 3];

interface Props {
  option: EChartsOption;
  height?: number | string;
  className?: string;
  /** 启用画线标注（默认开） */
  annotationsEnabled?: boolean;
  /** 画线数据受控（用于持久化/外部状态） */
  annotations?: Annotation[];
  onAnnotationsChange?: (list: Annotation[]) => void;
  /** 标注持久化 key（存在则写入 localStorage，刷新后恢复） */
  storageKey?: string;
  /** 吸附数据（K 线 high/low），开启吸附时端点贴近最高/最低价 */
  snapBars?: Array<{ high: number; low: number }>;
  /** 额外图表回调 */
  onDataZoom?: (e?: unknown) => void;
  /** 遮罩说明文案 */
  hint?: string;
}

/**
 * 可标注 K 线图：EChart + SVG 画线覆盖层 + 工具栏
 * - 工具：选择/趋势线/水平线/垂直线/射线/通道线/矩形
 * - 样式配置：颜色 / 线型（实线/虚线/点线）/ 线宽
 * - 撤销（Ctrl+Z）/ 重做（Ctrl+Y）/ 一键清空
 * - 持久化：storageKey 存在时自动存 localStorage，刷新恢复
 * - 导入/导出：标注数据可下载为 JSON / 从 JSON 恢复
 */
export default function AnnotatableChart({
  option,
  height = 400,
  className = "",
  annotationsEnabled = true,
  annotations: extAnnotations,
  onAnnotationsChange,
  storageKey,
  snapBars,
  onDataZoom,
  hint,
}: Props) {
  const chartRef = useRef<echarts.ECharts | null>(null);
  const [chart, setChart] = useState<echarts.ECharts | null>(null);
  const [activeTool, setActiveTool] = useState<AnnotationTool>("select");
  const [showTip, setShowTip] = useState(true);
  const [internal, setInternal] = useState<Annotation[]>([]);
  const [zoomTick, setZoomTick] = useState(0);

  // 画线样式配置（创建新标注时生效）
  const [penColor, setPenColor] = useState(PEN_COLORS[0]);
  const [penDash, setPenDash] = useState<DashType>("solid");
  const [penWidth, setPenWidth] = useState(1.5);
  const [snapEnabled, setSnapEnabled] = useState(false);
  const [showStyle, setShowStyle] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // 撤销/重做历史栈
  const [past, setPast] = useState<Annotation[][]>([]);
  const [future, setFuture] = useState<Annotation[][]>([]);
  const latestRef = useRef<Annotation[]>([]);
  const historyLock = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const annotations = extAnnotations ?? internal;
  latestRef.current = annotations;

  const setAnnotations = (list: Annotation[]) => {
    if (onAnnotationsChange) onAnnotationsChange(list);
    else setInternal(list);
  };

  /** 统一变更入口：记录历史后应用（拖拽中间态节流，避免历史栈被中间帧塞满） */
  const lastCommitRef = useRef(0);
  const applyChange = useCallback(
    (list: Annotation[]) => {
      if (!historyLock.current) {
        const now = Date.now();
        // 400ms 内的连续变更视为同一操作（如拖拽端点），只记录一次历史
        if (now - lastCommitRef.current > 400) {
          setPast((p) => (p.length > 49 ? [...p.slice(p.length - 49), latestRef.current] : [...p, latestRef.current]));
          setFuture([]);
          lastCommitRef.current = now;
        }
      }
      setAnnotations(list);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onAnnotationsChange]
  );

  const undo = useCallback(() => {
    setPast((p) => {
      if (!p.length) return p;
      const prev = p[p.length - 1];
      setFuture((f) => [...f, latestRef.current]);
      historyLock.current = true;
      setAnnotations(prev);
      historyLock.current = false;
      return p.slice(0, -1);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onAnnotationsChange, past]);

  const redo = useCallback(() => {
    setFuture((f) => {
      if (!f.length) return f;
      const next = f[f.length - 1];
      setPast((p) => [...p, latestRef.current]);
      historyLock.current = true;
      setAnnotations(next);
      historyLock.current = false;
      return f.slice(0, -1);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onAnnotationsChange, future]);

  // 快捷键：Ctrl+Z 撤销 / Ctrl+Y 或 Ctrl+Shift+Z 重做
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!annotationsEnabled) return;
      const meta = e.ctrlKey || e.metaKey;
      if (!meta) return;
      if (e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [annotationsEnabled, undo, redo]);

  // 持久化：初始化从 localStorage 恢复（仅客户端）
  useEffect(() => {
    if (!storageKey || typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          latestRef.current = list;
          setInternal(list);
        }
      }
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  // 持久化：变更后写入 localStorage
  useEffect(() => {
    if (!storageKey || typeof window === "undefined") return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(annotations));
    } catch {
      /* ignore */
    }
  }, [annotations, storageKey]);

  // 导出标注为 JSON 文件
  const exportJson = () => {
    const payload = JSON.stringify(annotations, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${storageKey ?? "kline-annotations"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 导入标注（从 JSON 文件恢复）
  const importJson = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const list = JSON.parse(String(reader.result));
        if (Array.isArray(list)) applyChange(list as Annotation[]);
      } catch {
        /* ignore */
      }
    };
    reader.readAsText(file);
  };

  // 缩放/平移时强制画线层重绘（坐标已由 convertToPixel 动态计算，这里仅触发 React 重渲染）
  // 同时把 dataZoom 事件（含 start/end 百分比）透传给外部，供涨跌幅标注联动可视范围
  const handleZoom = (e?: unknown) => {
    setZoomTick((t) => t + 1);
    onDataZoom?.(e);
  };

  // tooltip 显隐开关：通过覆盖 option 实现
  const finalOption = useMemo(() => {
    if (showTip || !annotationsEnabled) return option;
    return { ...option, tooltip: { ...(option.tooltip as object ?? {}), show: false } } as EChartsOption;
  }, [option, showTip, annotationsEnabled]);

  const defaultStyle: AnnotationStyle = { color: penColor, dash: penDash, width: penWidth };

  return (
    <div className="space-y-2">
      {/* 工具栏：画线工具 + 样式配置 + 历史/清空/导入导出 */}
      <div className="flex flex-wrap items-center gap-1.5">
        {annotationsEnabled && (
          <div className="flex rounded-md border border-border overflow-hidden text-[11px] flex-wrap">
            {TOOLS.map((t) => (
              <button
                key={t.key}
                title={t.title}
                onClick={() => setActiveTool(t.key)}
                className={`px-2 py-1 ${activeTool === t.key ? "bg-primary/15 text-primary font-medium" : "text-muted hover:bg-muted/40"}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}
        {annotationsEnabled && (
          <>
            {/* 样式配置按钮 */}
            <button
              onClick={() => setShowStyle((v) => !v)}
              className={`px-2 py-1 rounded text-[11px] border ${showStyle ? "border-primary/40 text-primary bg-primary/10" : "border-border text-muted hover:border-primary/40"}`}
              title="画线样式：颜色/线型/线宽"
            >
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: penColor }} />
                {penDash === "solid" ? "─" : penDash === "dash" ? "┅" : "…"}
                {penWidth}
              </span>
            </button>
            <button
              onClick={() => setSnapEnabled((v) => !v)}
              className={`px-2 py-1 rounded text-[11px] border ${snapEnabled ? "border-primary/40 text-primary bg-primary/10 font-medium" : "border-border text-muted hover:border-primary/40"}`}
              title="端点吸附：贴近 K 线最高/最低价"
            >
              {snapEnabled ? "吸附：开" : "吸附：关"}
            </button>
            <span className="w-px h-4 bg-border" />
            <button
              onClick={undo}
              disabled={!past.length}
              className="px-2 py-1 rounded text-[11px] border border-border text-muted hover:border-primary/40 disabled:opacity-40"
              title="撤销（Ctrl+Z）"
            >
              ↩ 撤销
            </button>
            <button
              onClick={redo}
              disabled={!future.length}
              className="px-2 py-1 rounded text-[11px] border border-border text-muted hover:border-primary/40 disabled:opacity-40"
              title="重做（Ctrl+Y）"
            >
              ↪ 重做
            </button>
            <button
              onClick={() => applyChange([])}
              className="px-2 py-1 rounded text-[11px] border border-border text-muted hover:text-red-500 hover:border-red-400"
              title="清除全部标注"
            >
              🗑 清空
            </button>
            <button
              onClick={exportJson}
              className="px-2 py-1 rounded text-[11px] border border-border text-muted hover:border-primary/40"
              title="导出标注为 JSON（可分享/复用）"
            >
              ⇩ 导出
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              className="px-2 py-1 rounded text-[11px] border border-border text-muted hover:border-primary/40"
              title="从 JSON 文件导入标注"
            >
              ⇧ 导入
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importJson(f);
                e.target.value = "";
              }}
            />
            <span className="text-[10px] text-muted">{annotations.length} 条</span>
          </>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          <button
            onClick={() => setShowTip((v) => !v)}
            className={`px-2 py-1 rounded text-[11px] border ${showTip ? "border-primary/40 text-primary bg-primary/10" : "border-border text-muted"}`}
            title="切换悬停提示卡片显隐"
          >
            {showTip ? "🔍 提示开" : "🔍 提示关"}
          </button>
        </div>
      </div>

      {/* 样式配置面板 */}
      {annotationsEnabled && showStyle && (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-muted/20 px-3 py-2 text-[11px]">
          <span className="text-muted">颜色</span>
          <div className="flex gap-1">
            {PEN_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setPenColor(c)}
                className={`w-4 h-4 rounded-full ${penColor === c ? "ring-2 ring-primary ring-offset-1" : ""}`}
                style={{ background: c }}
                title={c}
              />
            ))}
          </div>
          <span className="w-px h-4 bg-border" />
          <span className="text-muted">线型</span>
          <div className="flex rounded border border-border overflow-hidden">
            {PEN_DASHES.map((d) => (
              <button
                key={d.key}
                onClick={() => setPenDash(d.key)}
                className={`px-2 py-0.5 ${penDash === d.key ? "bg-primary/15 text-primary font-medium" : "text-muted"}`}
                title={d.key === "solid" ? "实线" : d.key === "dash" ? "虚线" : "点线"}
              >
                {d.label}
              </button>
            ))}
          </div>
          <span className="w-px h-4 bg-border" />
          <span className="text-muted">线宽</span>
          <div className="flex rounded border border-border overflow-hidden">
            {PEN_WIDTHS.map((w) => (
              <button
                key={w}
                onClick={() => setPenWidth(w)}
                className={`px-2 py-0.5 ${penWidth === w ? "bg-primary/15 text-primary font-medium" : "text-muted"}`}
              >
                {w}
              </button>
            ))}
          </div>
          <span className="ml-auto text-muted/70">应用于新建标注 · 选中标注后点「应用到选中」修改已画线条</span>
          {selectedId && (
            <button
              onClick={() => {
                applyChange(
                  annotations.map((a) =>
                    a.id === selectedId ? { ...a, color: penColor, style: { dash: penDash, width: penWidth } } : a
                  )
                );
              }}
              className="px-2.5 py-1 rounded text-[11px] bg-primary text-white font-medium hover:bg-primary-dark"
            >
              ✓ 应用到选中标注
            </button>
          )}
        </div>
      )}

      {/* 图表 + 画线层（画线 SVG 渲染进 ECharts 容器内部，事件冒泡天然到达 ECharts） */}
      <div className="relative">
        <EChart
          option={finalOption}
          height={height}
          className={className}
          chartRef={chartRef}
          onDataZoom={handleZoom}
          onReady={(c) => setChart(c)}
        >
          {annotationsEnabled && (
            <KlineAnnotations
              key={`${zoomTick}-${chart ? "ready" : "init"}`}
              chart={chart}
              activeTool={activeTool}
              annotations={annotations}
              onChange={applyChange}
              defaultStyle={defaultStyle}
              bars={snapBars}
              snapToHighLow={snapEnabled}
              onSelectChange={setSelectedId}
            />
          )}
        </EChart>
      </div>

      {hint && <p className="text-[10px] text-muted leading-relaxed">{hint}</p>}
    </div>
  );
}
