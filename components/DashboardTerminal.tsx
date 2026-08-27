"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { GripVertical, Eye, EyeOff, Settings2, LayoutGrid } from "lucide-react";
import GlobalHeatmap from "@/components/GlobalHeatmap";
import MarketDashboard from "@/components/MarketDashboard";
import MarketOverviewCard from "@/components/terminal/MarketOverviewCard";
import MacroGaugeCard from "@/components/terminal/MacroGaugeCard";

interface TermModule {
  id: string;
  name: string;
  desc: string;
  render: () => React.ReactNode;
}

const DEFAULT_ORDER = ["overview", "heatmap", "macro", "sector"];

const MODULES: Record<string, TermModule> = {
  overview: {
    id: "overview",
    name: "行情速览",
    desc: "A 股指数 · 全球指数 · 汇金油实时",
    render: () => <MarketOverviewCard />,
  },
  heatmap: {
    id: "heatmap",
    name: "全球热力",
    desc: "全球主要市场指数与龙头股涨跌全景",
    render: () => <GlobalHeatmap />,
  },
  macro: {
    id: "macro",
    name: "宏观仪表",
    desc: "宏观阶段 · 评分 · 资产偏好（真实数据自算）",
    render: () => <MacroGaugeCard />,
  },
  sector: {
    id: "sector",
    name: "板块资金",
    desc: "板块主力资金流 · 北向资金 · 自选下钻",
    render: () => <MarketDashboard />,
  },
};

const ORDER_KEY = "dash-order-v1";
const HIDDEN_KEY = "dash-hidden-v1";

/**
 * 首页数据终端：行情速览 / 全球热力 / 宏观仪表 / 板块资金 四模块
 * 支持拖拽排序 + 启停开关（localStorage 持久化），模块可点击下钻
 */
export default function DashboardTerminal() {
  const [order, setOrder] = useState<string[]>(DEFAULT_ORDER);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  // 拖拽源用 ref 同步记录（state 异步，快速拖拽时 drop 前可能未生效）
  const [dragging, setDragging] = useState<string | null>(null);
  const draggingRef = useRef<string | null>(null);
  const [showCustom, setShowCustom] = useState(false);
  const [ready, setReady] = useState(false);

  // 读取持久化配置
  useEffect(() => {
    try {
      const o = localStorage.getItem(ORDER_KEY);
      if (o) {
        const arr = JSON.parse(o);
        if (Array.isArray(arr) && arr.length) setOrder(arr);
      }
      const h = localStorage.getItem(HIDDEN_KEY);
      if (h) setHidden(new Set(JSON.parse(h)));
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  // 持久化
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(ORDER_KEY, JSON.stringify(order));
    } catch {
      /* ignore */
    }
  }, [order, ready]);
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(HIDDEN_KEY, JSON.stringify([...hidden]));
    } catch {
      /* ignore */
    }
  }, [hidden, ready]);

  const visible = useMemo(() => order.filter((id) => !hidden.has(id)), [order, hidden]);

  const toggleHidden = (id: string) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // 拖拽排序
  const onDrop = (targetId: string) => {
    const src = draggingRef.current;
    if (!src || src === targetId) return;
    setOrder((prev) => {
      const arr = prev.filter((id) => id !== src);
      const idx = arr.indexOf(targetId);
      arr.splice(idx < 0 ? arr.length : idx, 0, src);
      return arr;
    });
    draggingRef.current = null;
    setDragging(null);
  };

  const beginDrag = (id: string) => {
    draggingRef.current = id;
    setDragging(id);
  };
  const endDrag = () => {
    draggingRef.current = null;
    setDragging(null);
  };

  const gridClass =
    visible.length === 1
      ? "grid grid-cols-1"
      : visible.length === 2
        ? "grid grid-cols-1 lg:grid-cols-2"
        : "grid grid-cols-1 xl:grid-cols-2";

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <h2 className="flex items-center gap-2 font-bold text-lg tracking-tight">
          <LayoutGrid className="w-4.5 h-4.5 text-primary" /> 数据终端
        </h2>
        <span className="text-[11px] text-muted">拖拽排序 · 眼睛开关模块 · 布局自动保存</span>
        <button
          onClick={() => setShowCustom((s) => !s)}
          className="ml-auto flex items-center gap-1 text-[11px] px-2 py-1 rounded-md border border-border text-muted hover:text-primary hover:border-primary/50 transition-colors"
        >
          <Settings2 className="w-3 h-3" /> 自定义
        </button>
      </div>

      {showCustom && (
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs font-bold mb-2">模块开关（拖拽卡片调整顺序）</p>
          <div className="flex flex-wrap gap-2">
            {order.map((id) => (
              <button
                key={id}
                onClick={() => toggleHidden(id)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs border transition-colors ${
                  hidden.has(id)
                    ? "border-border text-muted opacity-50"
                    : "border-primary/40 bg-primary/10 text-primary font-medium"
                }`}
              >
                {hidden.has(id) ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                {MODULES[id]?.name}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-muted mt-2">点击切换显示/隐藏 · 在卡片标题栏拖动可重新排序</p>
        </div>
      )}

      <div className={gridClass}>
        {visible.map((id) => {
          const m = MODULES[id];
          if (!m) return null;
          return (
            <div
              key={id}
              draggable
              onDragStart={() => beginDrag(id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop(id)}
              onDragEnd={endDrag}
              className={`${visible.length === 1 ? "" : "min-w-0"} ${dragging === id ? "opacity-40" : ""} transition-opacity`}
            >
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div
                  className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/20 cursor-grab active:cursor-grabbing select-none"
                  title="拖动调整顺序"
                >
                  <GripVertical className="w-3.5 h-3.5 text-muted" />
                  <span className="text-xs font-bold">{m.name}</span>
                  <span className="text-[10px] text-muted hidden sm:inline">{m.desc}</span>
                  <button
                    onClick={() => toggleHidden(id)}
                    className="ml-auto flex items-center gap-1 text-[10px] text-muted hover:text-primary transition-colors"
                    title="隐藏此模块"
                  >
                    <EyeOff className="w-3 h-3" />
                  </button>
                </div>
                <div className="p-2.5">{m.render()}</div>
              </div>
            </div>
          );
        })}
      </div>

      {visible.length === 0 && (
        <p className="text-sm text-muted py-8 text-center">所有模块已隐藏——点右上角「自定义」重新开启</p>
      )}
    </section>
  );
}
