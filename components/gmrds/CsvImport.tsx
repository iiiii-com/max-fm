"use client";

import { useRef, useState } from "react";

export interface ImportedBar {
  date: string;
  open: number;
  close: number;
  high: number;
  low: number;
  volume: number;
}

const SAMPLE_CSV = `date,open,close,high,low,volume
2026-01-02,3300.00,3320.50,3340.00,3285.00,450000000
2026-01-05,3321.00,3350.20,3360.00,3310.00,520000000`;

/** CSV 解析：支持逗号/制表符、可选表头、日期+OHLCV */
function parseCsv(text: string): ImportedBar[] {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  const out: ImportedBar[] = [];
  const sep = lines[0].includes("\t") ? "\t" : ",";
  lines.forEach((line, idx) => {
    const cells = line.split(sep).map((c) => c.trim());
    if (idx === 0 && cells[0].toLowerCase().includes("date")) return; // 跳过表头
    const nums = cells.slice(1).map(Number);
    if (!/^\d{4}[-/]\d{2}[-/]\d{2}/.test(cells[0] ?? "") || nums.some((n) => !isFinite(n))) return;
    const [open, close, high, low] = nums;
    out.push({
      date: cells[0].replace(/\//g, "-"),
      open, close,
      high: high ?? Math.max(open, close),
      low: low ?? Math.min(open, close),
      volume: nums[4] ?? 0,
    });
  });
  return out.sort((a, b) => (a.date < b.date ? -1 : 1));
}

/**
 * CSV 数据导入（粘贴或文件上传）→ 供买卖点扫描 / K 线实验台使用
 */
export default function CsvImport({ onData, onClose }: { onData: (bars: ImportedBar[]) => void; onClose?: () => void }) {
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const [picked, setPicked] = useState<ImportedBar[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const apply = (raw: string) => {
    try {
      const bars = parseCsv(raw);
      if (bars.length < 5) { setErr("解析失败：至少需要 5 行有效数据（date,open,close,high,low,volume）"); setPicked(null); return; }
      setErr("");
      setPicked(bars);
      onData(bars);
    } catch {
      setErr("CSV 解析失败，请检查格式");
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-bold">导入 CSV 行情数据</p>
        <div className="flex gap-1.5">
          <button onClick={() => fileRef.current?.click()} className="px-2.5 py-1 rounded text-[11px] border border-border text-muted hover:border-primary/40">上传文件</button>
          {onClose && <button onClick={onClose} className="px-2.5 py-1 rounded text-[11px] border border-border text-muted hover:border-red-400">关闭</button>}
        </div>
      </div>
      <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) f.text().then(apply).catch(() => setErr("文件读取失败"));
          e.target.value = "";
        }} />
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={`粘贴 CSV（date,open,close,high,low,volume），可含表头：\n${SAMPLE_CSV}`}
        className="w-full h-28 rounded-lg border border-border bg-background/60 text-xs p-2 font-mono focus:outline-none focus:border-primary/50"
      />
      <div className="flex items-center gap-2 mt-2">
        <button onClick={() => apply(text)} className="px-3 py-1.5 rounded text-[11px] bg-primary text-white font-medium hover:bg-primary-dark">解析并应用</button>
        <button onClick={() => setText(SAMPLE_CSV)} className="px-2.5 py-1.5 rounded text-[11px] border border-border text-muted hover:border-primary/40">填入示例</button>
        {picked && <span className="text-[11px] text-green-600">✓ 已导入 {picked.length} 根（{picked[0].date} ~ {picked[picked.length - 1].date}）</span>}
      </div>
      {err && <p className="text-[11px] text-red-500 mt-1.5">{err}</p>}
    </div>
  );
}
