"use client";

import { useState } from "react";
import BuySellScanner from "./BuySellScanner";
import CsvImport, { type ImportedBar } from "./CsvImport";

/**
 * 买卖点扫描区（含 CSV 导入联动）：默认真实上证数据，可导入自定义数据后重扫
 */
export default function ScannerSection({ defaultBars }: { defaultBars: ImportedBar[] }) {
  const [bars, setBars] = useState<ImportedBar[]>(defaultBars);
  const [showImport, setShowImport] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] text-muted">
          当前数据：{bars.length} 根（{bars[0]?.date} ~ {bars[bars.length - 1]?.date}）
          {showImport ? " · 已切换为导入数据" : " · 默认上证日线"}
        </span>
        <button
          onClick={() => setShowImport((v) => !v)}
          className="px-2.5 py-1 rounded text-[11px] border border-border text-muted hover:border-primary/40"
        >
          {showImport ? "收起导入" : "导入 CSV 行情"}
        </button>
        {showImport && (
          <button
            onClick={() => { setBars(defaultBars); setShowImport(false); }}
            className="px-2.5 py-1 rounded text-[11px] border border-border text-muted hover:border-primary/40"
          >
            恢复默认数据
          </button>
        )}
      </div>
      {showImport && <CsvImport onData={(b) => setBars(b)} onClose={() => setShowImport(false)} />}
      <BuySellScanner bars={bars} />
    </div>
  );
}
