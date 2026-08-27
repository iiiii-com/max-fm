"use client";

import { useEffect, useMemo, useState } from "react";
import { scanSignals } from "@/lib/data/rule-engine";

interface Row {
  secid: string;
  name: string;
  price: number | null;
  changePct: number | null;
  pe: number | null;
  signalCount: number;
  lastSignal: string; // 最近信号描述
  verdict: string;
  tone: "red" | "green" | "gray";
}

/** 预设股票池（A 股龙头，含全球） */
const PRESET = [
  { secid: "1.600519", name: "贵州茅台" },
  { secid: "0.300750", name: "宁德时代" },
  { secid: "1.600036", name: "招商银行" },
  { secid: "0.002594", name: "比亚迪" },
  { secid: "1.601318", name: "中国平安" },
  { secid: "0.000858", name: "五粮液" },
  { secid: "0.002415", name: "海康威视" },
  { secid: "1.688981", name: "中芯国际" },
  { secid: "1.600030", name: "中信证券" },
  { secid: "0.300059", name: "东方财富" },
  { secid: "1.600900", name: "长江电力" },
  { secid: "1.601899", name: "紫金矿业" },
];

function verdictOf(pe: number | null) {
  if (pe == null) return { text: "—", tone: "gray" as const };
  if (pe < 15) return { text: "低估", tone: "green" as const };
  if (pe <= 30) return { text: "合理", tone: "gray" as const };
  return { text: "高估", tone: "red" as const };
}

/** 批量扫描：自选/预设池 → 信号 + 估值汇总 */
export default function BatchScanner() {
  const [useWatchlist, setUseWatchlist] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [scanning, setScanning] = useState(false);
  const [err, setErr] = useState("");

  const pool = useMemo(() => {
    if (!useWatchlist) return PRESET;
    try {
      const w = JSON.parse(localStorage.getItem("max-watchlist") || "[]");
      const arr = Array.isArray(w) ? w.filter((x: any) => x.secid && x.name) : [];
      return arr.map((x: any) => ({ secid: x.secid, name: x.name })).slice(0, 12);
    } catch {
      return [];
    }
  }, [useWatchlist]);

  const run = async () => {
    if (!pool.length) { setErr("股票池为空（自选列表为空？）"); return; }
    setScanning(true);
    setErr("");
    setRows([]);
    const out: Row[] = [];
    // 并行拉取（限并发 4，避免数据源压力）
    const queue = [...pool];
    const worker = async () => {
      while (queue.length) {
        const item = queue.shift()!;
        try {
          const [k, f] = await Promise.all([
            fetch(`/api/stock/kline?secid=${item.secid}&days=120`, { cache: "no-store" }).then((r) => r.json()),
            fetch(`/api/stock/fundamentals?secid=${item.secid}`, { cache: "no-store" }).then((r) => r.json()),
          ]);
          const bars = k?.klines;
          const price = bars?.length ? bars[bars.length - 1].close : null;
          const prev = bars?.length > 1 ? bars[bars.length - 2].close : null;
          const changePct = price && prev ? Number((((price - prev) / prev) * 100).toFixed(2)) : null;
          const sigs = bars ? scanSignals(bars) : [];
          const last = sigs[sigs.length - 1];
          const pe = Number(f?.data?.pe) || null;
          const v = verdictOf(pe);
          out.push({
            secid: item.secid,
            name: item.name,
            price,
            changePct,
            pe,
            signalCount: sigs.length,
            lastSignal: last ? `${last.type === "buy" ? "▲买" : "▼卖"}·${last.rule.slice(0, 10)}` : "无",
            verdict: v.text,
            tone: v.tone,
          });
        } catch {
          out.push({ secid: item.secid, name: item.name, price: null, changePct: null, pe: null, signalCount: 0, lastSignal: "数据受限", verdict: "—", tone: "gray" });
        }
      }
    };
    await Promise.all([worker(), worker(), worker(), worker()]);
    // 按信号数 + 涨跌排序
    out.sort((a, b) => (b.signalCount - a.signalCount) || (b.changePct ?? 0) - (a.changePct ?? 0));
    setRows(out);
    setScanning(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setUseWatchlist(false)}
          className={`px-3 py-1.5 rounded-md text-xs border transition-colors ${!useWatchlist ? "border-primary bg-primary/10 text-primary font-medium" : "border-border text-muted"}`}
        >
          预设龙头池（12 只）
        </button>
        <button
          onClick={() => setUseWatchlist(true)}
          className={`px-3 py-1.5 rounded-md text-xs border transition-colors ${useWatchlist ? "border-primary bg-primary/10 text-primary font-medium" : "border-border text-muted"}`}
        >
          我的自选（{useWatchlist ? pool.length : "—"}只）
        </button>
        <button
          onClick={run}
          disabled={scanning}
          className="ml-auto px-4 py-1.5 rounded-md bg-primary text-white text-xs font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {scanning ? "扫描中…" : "▶ 开始扫描"}
        </button>
      </div>

      {err && <p className="text-xs text-destructive">{err}</p>}

      {rows.length > 0 && (
        <div className="rounded-lg border border-border overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="text-xs text-muted border-b border-border bg-muted/20">
                {["标的", "现价", "涨跌", "PE", "信号数", "最近信号", "估值"].map((h) => (
                  <th key={h} className="text-left py-2 px-3 font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.secid} className="border-b border-border/40 last:border-0 hover:bg-muted/10 cursor-pointer" onClick={() => (window.location.href = `/stock/${encodeURIComponent(r.secid)}`)}>
                  <td className="py-1.5 px-3 font-medium">{r.name}</td>
                  <td className="py-1.5 px-3 font-mono">{r.price?.toFixed(2) ?? "—"}</td>
                  <td className="py-1.5 px-3 font-mono font-bold" style={{ color: r.changePct == null ? "#64748b" : r.changePct >= 0 ? "#dc2626" : "#16a34a" }}>
                    {r.changePct == null ? "—" : `${r.changePct >= 0 ? "+" : ""}${r.changePct.toFixed(2)}%`}
                  </td>
                  <td className="py-1.5 px-3 font-mono">{r.pe?.toFixed(1) ?? "—"}</td>
                  <td className="py-1.5 px-3">
                    <span className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${r.signalCount > 0 ? "bg-primary/10 text-primary" : "text-muted"}`}>{r.signalCount}</span>
                  </td>
                  <td className="py-1.5 px-3 text-xs">{r.lastSignal}</td>
                  <td className="py-1.5 px-3 text-xs font-bold" style={{ color: r.tone === "red" ? "#dc2626" : r.tone === "green" ? "#16a34a" : "#64748b" }}>{r.verdict}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[10px] text-muted px-3 py-2">点击行进入聚合深度页 · 信号=买卖点扫描（环节 7）· 估值=PE vs 15-30 中枢 · 数据源多源容错</p>
        </div>
      )}

      {!rows.length && !scanning && (
        <p className="text-sm text-muted py-4 text-center">选择股票池后点「开始扫描」——批量获取信号 / 估值 / 涨跌（并行 4 通道）</p>
      )}
    </div>
  );
}
