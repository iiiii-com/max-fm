"use client";

export type ChartType = "line" | "bar" | "area";
export type ChartRange = 12 | 36 | 60 | 0;

export const RANGE_OPTIONS: Array<{ label: string; value: ChartRange }> = [
  { label: "近1年", value: 12 },
  { label: "近3年", value: 36 },
  { label: "近5年", value: 60 },
  { label: "全部", value: 0 },
];

export function downloadCSV(filename: string, header: string[], rows: (string | number)[][]) {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const csv = [header.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))].join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function ChartToolbar({
  type, setType, range, setRange, log, setLog, canLog = false, onExport,
}: {
  type: ChartType; setType: (t: ChartType) => void;
  range: ChartRange; setRange: (r: ChartRange) => void;
  log: boolean; setLog: (v: boolean) => void;
  canLog?: boolean; onExport: () => void;
}) {
  const TYPES: Array<{ key: ChartType; label: string }> = [
    { key: "line", label: "折线" },
    { key: "area", label: "面积" },
    { key: "bar", label: "柱状" },
  ];
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <div className="flex rounded-lg border border-border overflow-hidden">
        {TYPES.map((t) => (
          <button
            key={t.key}
            onClick={() => setType(t.key)}
            className={`px-2 py-0.5 text-[11px] transition-colors ${type === t.key ? "bg-primary text-white" : "hover:bg-border/40"}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <select
        value={range}
        onChange={(e) => setRange(Number(e.target.value) as ChartRange)}
        className="px-1.5 py-0.5 rounded-lg border border-border bg-background text-[11px]"
      >
        {RANGE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
      </select>
      <button
        onClick={() => setLog(!log)}
        disabled={!canLog}
        title={canLog ? "切换对数刻度" : "数据含非正值，无法使用对数轴"}
        className={`px-2 py-0.5 rounded-lg border text-[11px] transition-colors disabled:opacity-35 disabled:cursor-not-allowed ${log ? "bg-primary text-white border-primary" : "border-border hover:border-primary/50"}`}
      >
        log
      </button>
      <button
        onClick={onExport}
        className="px-2 py-0.5 rounded-lg border border-border text-[11px] hover:border-primary/50 transition-colors"
      >
        导出 CSV
      </button>
    </div>
  );
}