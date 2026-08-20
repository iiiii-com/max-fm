"use client";

import { useImperativeHandle, useRef, useState } from "react";
import type { Ref } from "react";

export interface VirtualAccountHandle {
  start: () => void;
  setPosition: (pos: number) => void;
  step: (marketReturn: number) => void;
  getState: () => { cash: number; position: number; nav: number };
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

export default function VirtualAccount({
  capital, marketName, ref,
}: {
  capital: number;
  marketName: string;
  ref?: Ref<VirtualAccountHandle>;
}) {
  const [cash, setCash] = useState(0);
  const [position, setPosition] = useState(1);
  const [nav, setNav] = useState(0);
  const capitalRef = useRef(capital);

  useImperativeHandle(ref, () => ({
    start: () => {
      capitalRef.current = capital;
      setNav(capital);
      setCash(capital);
      setPosition(1);
    },
    setPosition: (pos: number) => {
      const p = clamp01(pos);
      setPosition(p);
      setCash(nav * (1 - p));
    },
    step: (marketReturn: number) => {
      const next = cash + (nav - cash) * (1 + marketReturn);
      setNav(Number.isFinite(next) ? next : nav);
    },
    getState: () => ({ cash, position, nav }),
  }), [capital, cash, position, nav]);

  const handleSetPosition = (pos: number) => {
    const p = clamp01(pos);
    setPosition(p);
    setCash(nav * (1 - p));
  };

  const ret = capital > 0 ? nav / capital - 1 : 0;
  const stockValue = nav - cash;
  const cashPct = nav > 0 ? (cash / nav) * 100 : 0;

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <div>
          <p className="text-xs text-muted mb-1">总资产（主市场：{marketName}）</p>
          <p className="text-3xl font-bold font-mono leading-none">¥ {fmtMoney(nav)}</p>
        </div>
        <p className={`text-xl font-mono font-bold ${ret >= 0 ? "up" : "down"}`}>
          {fmtPct(ret)}
        </p>
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
          onChange={(e) => handleSetPosition(Number(e.target.value) / 100)}
          className="w-full"
          style={{ accentColor: "var(--primary)" }}
        />
        <div className="flex gap-2 mt-2">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => handleSetPosition(p.pos)}
              className={`flex-1 px-2 py-1.5 rounded-md border text-xs font-medium transition-colors ${
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
        <div className="flex h-2 rounded overflow-hidden bg-border/60">
          <div style={{ width: `${cashPct}%`, background: "var(--muted)" }} />
          <div style={{ width: `${100 - cashPct}%`, background: "var(--primary)" }} />
        </div>
        <div className="flex justify-between mt-1.5 text-xs text-muted">
          <span>现金 ¥ {fmtMoney(cash)}</span>
          <span>市值 ¥ {fmtMoney(stockValue)}</span>
        </div>
      </div>
    </div>
  );
}