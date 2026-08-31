"use client";

/* ============================================================
   GmtCard —— GMT 终端组件卡壳
   头部：编号(琥珀) + 标题 + as-of + ▲▼(编辑) + 🔒 — ⤢ ✕
   编辑模式：拖动卡头移动（网格吸附）、右下角缩放、锁定
   点击头聚焦；数据口径注脚放 gmt-note
   ============================================================ */
import { useCallback, useRef, type ReactNode } from "react";
import { GAP, ROWH, type GridItem } from "./useLabGrid";

export interface GmtCardProps {
  id: string;
  num: string;
  title: string;
  asOf?: string;
  layout: GridItem;
  editing: boolean;
  focused: boolean;
  zoomed: boolean;
  desktop: boolean;
  containerW: number;
  geometry: (it: GridItem, w: number) => { left: number; top: number; width: number; height: number };
  onFocus: (id: string | null) => void;
  onAction: (id: string, act: "up" | "down" | "lock" | "min" | "zoom" | "close") => void;
  onMove: (id: string, x: number, y: number) => void;
  onResize: (id: string, w: number, h: number) => void;
  children: ReactNode;
  note?: ReactNode;
  /** body 是否填满剩余高度（图表类） */
  fill?: boolean;
}

export default function GmtCard(props: GmtCardProps) {
  const {
    id, num, title, asOf, layout, editing, focused, zoomed, desktop,
    containerW, geometry, onFocus, onAction, onMove, onResize, children, note, fill,
  } = props;
  const dragState = useRef<{ mode: "move" | "resize"; startX: number; startY: number; orig: GridItem } | null>(null);

  const cls = [
    "gmt-widget",
    layout.minimized ? "min" : "",
    layout.locked ? "locked" : "",
    zoomed ? "zoomed" : "",
    focused ? "focused" : "",
    dragState.current ? "dragging" : "",
  ].join(" ");

  const style: React.CSSProperties = zoomed
    ? { position: "fixed", top: "34px", left: 0, right: 0, bottom: 0, zIndex: 300 }
    : desktop
      ? { ...geometry(layout, containerW) }
      : { order: layout.mobileOrder ?? 0 };

  const startDrag = useCallback(
    (e: React.PointerEvent, mode: "move" | "resize") => {
      if (!editing || layout.locked) return;
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      dragState.current = { mode, startX: e.clientX, startY: e.clientY, orig: { ...layout } };
      onFocus(id);
    },
    [editing, layout, onFocus, id]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const st = dragState.current;
      if (!st || !desktop) return;
      const colW = (containerW - GAP * 13) / 12;
      const dx = e.clientX - st.startX;
      const dy = e.clientY - st.startY;
      if (st.mode === "move") {
        const nx = Math.max(0, Math.min(12 - st.orig.w, Math.round(st.orig.x + dx / (colW + GAP))));
        const ny = Math.max(0, Math.round(st.orig.y + dy / (ROWH + GAP)));
        onMove(id, nx, ny);
      } else {
        const nw = Math.max(3, Math.min(12 - st.orig.x, Math.round(st.orig.w + dx / (colW + GAP))));
        const nh = Math.max(2, Math.round(st.orig.h + dy / (ROWH + GAP)));
        onResize(id, nw, nh);
      }
    },
    [desktop, containerW, onMove, onResize, id]
  );

  const endDrag = useCallback(() => {
    dragState.current = null;
  }, []);

  const minH = desktop ? undefined : layout.minimized ? undefined : 420;

  return (
    <section
      id={`w-${id}`}
      className={cls}
      style={desktop && !zoomed ? style : { ...style, height: zoomed ? undefined : minH }}
      role="region"
      aria-label={title}
      onPointerDown={() => onFocus(id)}
    >
      <div
        className="gmt-w-head"
        onDoubleClick={() => onAction(id, "min")}
      >
        <span className="gmt-w-num">{num}</span>
        <span className="gmt-w-title">{title}</span>
        {asOf && <span className="gmt-w-asof">as-of {asOf}</span>}
        <span className="gmt-w-order">
          <button className="gmt-w-btn" data-act="up" title="上移" aria-label="上移组件" onClick={() => onAction(id, "up")}>▲</button>
          <button className="gmt-w-btn" data-act="down" title="下移" aria-label="下移组件" onClick={() => onAction(id, "down")}>▼</button>
        </span>
        <button className="gmt-w-btn" data-act="lock" title={layout.locked ? "解锁位置" : "锁定位置"} aria-label={layout.locked ? "解锁位置" : "锁定位置"} onClick={() => onAction(id, "lock")}>
          {layout.locked ? "🔒" : "🔓"}
        </button>
        <button className="gmt-w-btn" data-act="min" title={layout.minimized ? "还原" : "最小化"} aria-label={layout.minimized ? "还原组件" : "最小化组件"} onClick={() => onAction(id, "min")}>
          {layout.minimized ? "▫" : "—"}
        </button>
        <button className="gmt-w-btn" data-act="zoom" title={zoomed ? "还原" : "放大"} aria-label={zoomed ? "还原组件" : "放大组件"} onClick={() => onAction(id, "zoom")}>
          {zoomed ? "⤡" : "⤢"}
        </button>
        <button className="gmt-w-btn" data-act="close" title="移除组件" aria-label="移除组件" onClick={() => onAction(id, "close")}>✕</button>
        <div
          className="gmt-w-drag"
          aria-hidden="true"
          onPointerDown={(e) => startDrag(e, "move")}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        />
      </div>
      <div className="gmt-w-body">
        <div className={fill ? "gmt-fill" : undefined} style={fill ? { display: "flex", flexDirection: "column", minHeight: 0 } : undefined}>
          {children}
        </div>
        {note && <div className="gmt-note">{note}</div>}
      </div>
      {!layout.locked && (
        <div
          className="gmt-w-resize"
          aria-hidden="true"
          onPointerDown={(e) => startDrag(e, "resize")}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        />
      )}
    </section>
  );
}
