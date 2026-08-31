"use client";

/* ============================================================
   TermChrome —— GMT 终端骨架配件
   CmdBar（命令栏：logo/快捷键/徽章/时钟） · Tape（行情跑马灯，点击联动标的）
   Toolbar（编辑/预设/添加组件/恢复默认） · Inspector（数据来源检查器）
   HelpOverlay（F1 键盘帮助）
   ============================================================ */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";

/* ---------------- 命令栏 ---------------- */
export function CmdBar(props: {
  editing: boolean;
  inspector: boolean;
  dataOn: boolean;
  onHelp: () => void;
  onEdit: () => void;
  onData: () => void;
  onInspector: () => void;
  clock: string;
}) {
  const { editing, inspector, dataOn, onHelp, onEdit, onData, onInspector, clock } = props;
  return (
    <header className="gmt-cmdbar" role="banner">
      <div className="gmt-cmd-left">
        <span className="gmt-logo" aria-label="MX K线实验室">
          MX<b>//</b>K线实验室
        </span>
        <span className="gmt-ver">v1.0</span>
      </div>
      <nav className="gmt-cmd-mid" aria-label="快捷命令">
        <Link className="gmt-cmd-btn gmt-cmd-site" href="/">‹ 首页</Link>
        <Link className="gmt-cmd-btn gmt-cmd-site" href="/market">市场</Link>
        <Link className="gmt-cmd-btn gmt-cmd-site" href="/sector">板块</Link>
        <button className="gmt-cmd-btn" onClick={onHelp} title="键盘帮助">[F1] 帮助</button>
        <button className="gmt-cmd-btn" aria-pressed={editing} onClick={onEdit} title="切换布局编辑模式 (E)">[E] 编辑</button>
        <button className="gmt-cmd-btn" aria-pressed={dataOn} onClick={onData} title="数据状态面板 (D)">[D] 数据</button>
        <button className="gmt-cmd-btn" aria-pressed={inspector} onClick={onInspector} title="切换检查器 (I)">[I] 检查</button>
      </nav>
      <div className="gmt-cmd-right">
        <span className="gmt-mode-badge">真实行情</span>
        <span className="gmt-conn" title="数据来源：东方财富/腾讯/新浪公开行情接口">● 快照</span>
        <span className="gmt-clock" aria-label="当前时间">{clock || "--:--:--"}</span>
      </div>
    </header>
  );
}

/* ---------------- 跑马灯 ---------------- */
export interface TapeQuote {
  code: string;
  secid?: string;
  name: string;
  price: number;
  changePct: number;
}

export function Tape(props: {
  items: TapeQuote[];
  paused: boolean;
  onPause: () => void;
  activeSecid?: string;
  onPick: (q: TapeQuote) => void;
}) {
  const { items, paused, onPause, activeSecid, onPick } = props;
  const doubled = items.length ? [...items, ...items] : [];
  return (
    <div className="gmt-tape-wrap" aria-label="全球行情跑马灯">
      <button className="gmt-tape-ctl" aria-pressed={paused} title="暂停 / 继续跑马灯" onClick={onPause}>
        {paused ? "▶" : "❚❚"}
      </button>
      <div className="gmt-tape-viewport">
        <div className={`gmt-tape${paused ? " paused" : ""}`} role="list">
          {doubled.map((q, i) => (
            <button
              key={`${q.code}-${i}`}
              role="listitem"
              className={`gmt-tape-item${q.secid === activeSecid ? " on" : ""}`}
              onClick={() => onPick(q)}
              title={`切换到 ${q.name}`}
            >
              <span className="ts">{q.name}</span>
              <span className="tl">{q.price?.toFixed?.(2)}</span>
              <span className={`tp ${q.changePct > 0 ? "up" : q.changePct < 0 ? "down" : "flat"}`}>
                {q.changePct > 0 ? "+" : ""}
                {q.changePct?.toFixed?.(2)}%
              </span>
            </button>
          ))}
          {!items.length && <span className="gmt-empty">行情加载中…</span>}
        </div>
      </div>
    </div>
  );
}

/* ---------------- 工具栏 ---------------- */
export function LabToolbar(props: {
  editing: boolean;
  preset: string;
  presets: Array<{ key: string; label: string }>;
  removedIds: string[];
  onPreset: (k: string) => void;
  onEdit: () => void;
  onReset: () => void;
  onRestore: (id: string) => void;
  cardLabels: Record<string, string>;
}) {
  const { editing, preset, presets, removedIds, onPreset, onEdit, onReset, onRestore, cardLabels } = props;
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="gmt-toolbar" role="toolbar" aria-label="布局控制">
      <button className="gmt-tb-btn" aria-pressed={editing} onClick={onEdit}>
        ▦ 编辑布局
      </button>
      {removedIds.length > 0 && (
        <div className="gmt-tb-group">
          <button className="gmt-tb-btn" aria-haspopup="true" aria-expanded={menuOpen} onClick={() => setMenuOpen((v) => !v)}>
            + 添加组件 ▾
          </button>
          {menuOpen && (
            <div className="gmt-menu" role="menu">
              {removedIds.map((id) => (
                <button key={id} role="menuitem" onClick={() => { onRestore(id); setMenuOpen(false); }}>
                  <span>{cardLabels[id] ?? id}</span>
                  <span aria-hidden="true">＋</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <span className="gmt-tb-sep" />
      <span className="gmt-tb-label">预设&gt;</span>
      {presets.map((p) => (
        <button key={p.key} className="gmt-tb-btn preset" aria-pressed={preset === p.key} onClick={() => onPreset(p.key)}>
          {p.label}
        </button>
      ))}
      <span className="gmt-tb-sep" />
      <button className="gmt-tb-btn warn" onClick={onReset}>
        ↺ 恢复默认
      </button>
      {editing && <span className="gmt-edit-hint">编辑模式 — 拖动标题条移动 · 拖右下角缩放 · 🔒 锁定 · 双击标题最小化</span>}
    </div>
  );
}

/* ---------------- 检查器 ---------------- */
export interface InspData {
  label: string;
  value: string;
  source?: string;
  asOf?: string;
  note?: string;
}

export function Inspector(props: { open: boolean; data: InspData | null; onClose: () => void }) {
  const { open, data, onClose } = props;
  if (!open) return null;
  return (
    <aside className="gmt-inspector" role="complementary" aria-label="数据与来源检查器">
      <div className="gmt-insp-head">
        <span>▣ 数据 / 来源检查器</span>
        <button className="gmt-w-btn" onClick={onClose} title="关闭 (Esc)" aria-label="关闭检查器">✕</button>
      </div>
      <div className="gmt-insp-body">
        {data ? (
          <dl>
            <dt>指标</dt>
            <dd>{data.label}</dd>
            <dt>数值</dt>
            <dd className="gmt-insp-v">{data.value}</dd>
            {data.asOf && (
              <>
                <dt>AS-OF</dt>
                <dd>{data.asOf}</dd>
              </>
            )}
            {data.source && (
              <>
                <dt>来源</dt>
                <dd>{data.source}</dd>
              </>
            )}
            {data.note && (
              <>
                <dt>口径</dt>
                <dd>{data.note}</dd>
              </>
            )}
          </dl>
        ) : (
          <p className="gmt-insp-empty">
            点击任意数值、行情行、信号或图表数据点，查看其数值、来源、口径与 as-of 时刻。
            <br />
            <br />
            本终端全部数据取自公开行情与财报接口（东方财富 / 腾讯 / 新浪），严禁虚构。
          </p>
        )}
      </div>
    </aside>
  );
}

/* ---------------- 帮助浮层 ---------------- */
export function HelpOverlay(props: { open: boolean; onClose: () => void }) {
  const { open, onClose } = props;
  if (!open) return null;
  return (
    <div className="gmt-overlay" role="dialog" aria-modal="true" aria-label="键盘快捷键" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="gmt-overlay-box">
        <div className="gmt-overlay-head">
          MX//帮助 — 键盘快捷键
          <button className="gmt-w-btn" onClick={onClose} aria-label="关闭帮助">✕</button>
        </div>
        <div className="gmt-overlay-body">
          <table className="gmt-kv">
            <tbody>
              <tr><td>[F1]</td><td>打开 / 关闭本帮助</td></tr>
              <tr><td>[E]</td><td>切换「编辑布局」模式</td></tr>
              <tr><td>[D]</td><td>显示 / 隐藏「数据状态」组件</td></tr>
              <tr><td>[I]</td><td>切换检查器面板</td></tr>
              <tr><td>[Esc]</td><td>关闭检查器 / 浮层 / 菜单 / 放大</td></tr>
              <tr><td>[Tab]</td><td>在控件之间移动焦点</td></tr>
            </tbody>
          </table>
          <p className="gmt-help-note">
            编辑模式：拖动组件标题条移动，拖动右下角缩放，🔒 锁定，— 最小化，⤢ 放大，✕ 移除（可在「添加组件」中恢复）。窄屏下用 ▲▼ 调整顺序。双击标题条可最小化 / 还原。
            <br />
            检查器：开启后点击任意数值可查看其来源与口径。带 Ctrl / Cmd / Alt 的组合键不会被终端占用。
          </p>
        </div>
      </div>
    </div>
  );
}

/* ---------------- 时钟 hook（客户端渲染，避免 hydration mismatch） ---------------- */
export function useClock() {
  const [clock, setClock] = useState("");
  useEffect(() => {
    const fmt = () => {
      const d = new Date();
      const p = (n: number) => String(n).padStart(2, "0");
      setClock(`${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`);
    };
    fmt();
    const t = setInterval(fmt, 1000);
    return () => clearInterval(t);
  }, []);
  return clock;
}

/** 点击委托：收集 data-insp 元素上的检查器数据（JSON） */
export function useInspectorDelegate(onPick: (d: InspData) => void) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const handler = (e: MouseEvent) => {
      const el = (e.target as HTMLElement)?.closest?.("[data-insp]") as HTMLElement | null;
      if (!el) return;
      try {
        const d = JSON.parse(el.getAttribute("data-insp") || "{}") as InspData;
        if (d?.label) onPick(d);
      } catch {
        /* 忽略坏数据 */
      }
    };
    root.addEventListener("click", handler);
    return () => root.removeEventListener("click", handler);
  }, [onPick]);
  return ref;
}
