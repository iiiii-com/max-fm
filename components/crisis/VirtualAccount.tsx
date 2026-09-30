"use client";

import { useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { Ref } from "react";

/**
 * 虚拟账户（危机重演内的模拟持仓）
 *
 * 实现要点 —— 三条都是修 bug，不是重构偏好：
 *
 * 1. 权威状态放在 useRef，不放 useState。
 *    旧实现用 useState + useImperativeHandle，handle 闭包捕获的是**当次渲染**的
 *    cash/nav。CrisisEngine 会在同一事件处理里连续调用 step()（例如自动播放推进），
 *    两次调用之间组件尚未重渲染，第二次拿到的仍是旧的 cash/nav，
 *    导致复利被吞掉一半 —— 表现为"连按几步收益不对"。
 *    改为 ref 持有真值，渲染层只订阅一份镜像。
 *
 * 2. getState() 读 ref，不读闭包。返回的一定是此刻的真实值。
 *
 * 3. 战绩持久化到 localStorage。旧实现纯内存，切危机或刷新即丢。
 *    这里按"危机 id"分桶，互不干扰。
 */

export interface AccountState {
  cash: number;
  position: number;
  nav: number;
  /** 历史轨迹：每步的日期与净值，用于结算页画曲线 */
  path: Array<{ date: string; nav: number; position: number }>;
}

export interface VirtualAccountHandle {
  start: (crisisId?: string) => void;
  setPosition: (pos: number) => void;
  /** 推进一个区间。date 仅用于轨迹标注 */
  step: (marketReturn: number, date?: string) => void;
  getState: () => AccountState;
  loadProgress: (crisisId: string) => boolean;
  clearProgress: (crisisId: string) => void;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const fmtMoney = (n: number) => Math.round(n).toLocaleString("zh-CN");
const fmtPct = (v: number) => `${v >= 0 ? "+" : ""}${(v * 100).toFixed(2)}%`;

const PRESETS = [
  { label: "满仓", pos: 1 },
  { label: "持有", pos: 0.7 },
  { label: "减半", pos: 0.5 },
  { label: "清仓", pos: 0 },
];

const STORE_PREFIX = "crisis-progress-v1";

function storeKey(crisisId: string) {
  return `${STORE_PREFIX}:${crisisId}`;
}

function readProgress(crisisId: string): AccountState | null {
  try {
    const raw = localStorage.getItem(storeKey(crisisId));
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<AccountState>;
    if (typeof p.nav !== "number" || !Number.isFinite(p.nav)) return null;
    return {
      cash: Number(p.cash) || 0,
      position: Number(p.position) || 0,
      nav: p.nav,
      path: Array.isArray(p.path) ? p.path : [],
    };
  } catch {
    return null;
  }
}

function writeProgress(crisisId: string, s: AccountState) {
  try {
    localStorage.setItem(storeKey(crisisId), JSON.stringify(s));
  } catch {
    /* 隐私模式下静默降级，不影响本次重演 */
  }
}

export default function VirtualAccount({
  capital, marketName, crisisId, ref, onStateChange,
}: {
  capital: number;
  marketName: string;
  /** 用于战绩分桶与持久化；不传则不持久化 */
  crisisId?: string;
  ref?: Ref<VirtualAccountHandle>;
  /** 状态变化回调：供外层同步 finalState，修掉"最终仓位恒 0%" */
  onStateChange?: (s: AccountState) => void;
}) {
  // 权威状态（可同步读写，不受渲染节奏影响）
  const S = useRef<AccountState>({ cash: capital, position: 1, nav: capital, path: [] });
  // 渲染镜像
  const [view, setView] = useState<AccountState>(S.current);

  const sync = useCallback(() => {
    setView({ ...S.current, path: [...S.current.path] });
    onStateChange?.({ ...S.current, path: [...S.current.path] });
  }, [onStateChange]);

  // 稳定引用：handle 内的方法不随渲染重建，避免 ref.current 指向过期闭包
  const api = useRef<VirtualAccountHandle>({
    start: () => {},
    setPosition: () => {},
    step: () => {},
    getState: () => S.current,
    loadProgress: () => false,
    clearProgress: () => {},
  });

  useImperativeHandle(ref, () => ({
    start: (cid?: string) => {
      const id = cid ?? crisisId;
      if (id) {
        const saved = readProgress(id);
        if (saved) {
          S.current = saved;
          sync();
          return;
        }
      }
      S.current = { cash: capital, position: 1, nav: capital, path: [{ date: "", nav: capital, position: 1 }] };
      sync();
    },
    setPosition: (pos: number) => {
      const p = clamp01(pos);
      S.current.position = p;
      S.current.cash = S.current.nav * (1 - p);
      sync();
    },
    step: (marketReturn: number, date?: string) => {
      // 读 ref 而非闭包：同一 tick 内连续调用也能正确复利
      const st = S.current;
      const next = st.cash + (st.nav - st.cash) * (1 + marketReturn);
      st.nav = Number.isFinite(next) ? next : st.nav;
      st.path.push({ date: date ?? "", nav: st.nav, position: st.position });
      sync();
      const id = crisisId;
      if (id) writeProgress(id, st);
    },
    getState: () => S.current,
    loadProgress: (cid: string) => {
      const saved = readProgress(cid);
      if (!saved) return false;
      S.current = saved;
      sync();
      return true;
    },
    clearProgress: (cid: string) => {
      try { localStorage.removeItem(storeKey(cid)); } catch { /* ignore */ }
    },
  }), [capital, crisisId, sync]);

  // 首次挂载：若有历史进度则恢复，否则从满仓起步
  useEffect(() => {
    if (!crisisId) {
      S.current = { cash: capital, position: 1, nav: capital, path: [{ date: "", nav: capital, position: 1 }] };
      sync();
      return;
    }
    const saved = readProgress(crisisId);
    S.current = saved ?? { cash: capital, position: 1, nav: capital, path: [{ date: "", nav: capital, position: 1 }] };
    sync();
    // 仅在 crisisId 变化时重置，避免每轮渲染重复读
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crisisId]);

  const { cash, position, nav } = view;
  const ret = capital > 0 && capital > 0 ? nav / capital - 1 : 0;
  const stockValue = nav - cash;
  const cashPct = nav > 0 ? (cash / nav) * 100 : 0;

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <div>
          <p className="text-xs text-muted mb-1">总资产（主市场：{marketName}）</p>
          <p className="text-3xl font-bold font-mono leading-none">¥ {fmtMoney(nav)}</p>
        </div>
        <p className={`text-xl font-mono font-bold ${ret >= 0 ? "up" : "down"}`}>{fmtPct(ret)}</p>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-muted">股票仓位</span>
          <span className="text-sm font-mono font-semibold">{Math.round(position * 100)}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={Math.round(position * 100)}
          onChange={(e) => api.current.setPosition(Number(e.target.value) / 100)}
          className="w-full"
          style={{ accentColor: "var(--primary)" }}
          aria-label="股票仓位"
        />
        <div className="flex gap-2 mt-2">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => api.current.setPosition(p.pos)}
              className={`flex-1 px-2 py-1.5 rounded-sm border text-xs font-medium transition-colors ${
                Math.abs(position - p.pos) < 0.001
                  ? "bg-primary text-white border-primary"
                  : "border-border hover:border-primary/50 text-muted"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4">
        <div className="flex h-2 overflow-hidden bg-border/60">
          <div style={{ width: `${cashPct}%`, background: "var(--muted)" }} />
          <div style={{ width: `${100 - cashPct}%`, background: "var(--primary)" }} />
        </div>
        <div className="flex justify-between mt-1.5 text-xs text-muted">
          <span>现金 ¥ {fmtMoney(cash)}</span>
          <span>市值 ¥ {fmtMoney(stockValue)}</span>
        </div>
      </div>

      {crisisId ? (
        <div className="mt-3 flex items-center justify-between">
          <p className="text-[10px] text-muted">进度自动保存在本机，可继续重演</p>
          <button
            type="button"
            onClick={() => { api.current.clearProgress(crisisId); api.current.start(crisisId); }}
            className="text-[10px] text-muted hover:text-foreground underline underline-offset-2"
          >
            重新开始
          </button>
        </div>
      ) : null}
    </div>
  );
}
