"use client";

import { useState } from "react";
import ProGate from "@/components/ProGate";

const TYPES = [
  { key: "diagnosis", label: "自选组合诊断", desc: "含每只标的的年化波动、最小方差权重与共同样本区间" },
  { key: "allocation", label: "SAA/TAA 配置比例", desc: "含目标比例、TAA 偏离区间与协方差窗口" },
  { key: "sector-rank", label: "行业景气排行", desc: "含四个因子明细与观测池说明" },
] as const;

/**
 * 导出入口。
 *
 * 用 download 链接而不是 fetch 拼 blob：CSV 响应带了 Content-Disposition，
 * 直接让浏览器走原生下载，既不占内存也不会因为前端处理出错而损坏编码。
 * 403 的情况（非专业版）在服务端就拦掉了，这里只负责不给出误导性的按钮。
 */
export default function ExportButtons({ enabled }: { enabled: boolean }) {
  const [busy, setBusy] = useState<string>("");

  if (!enabled) {
    return (
      <div className="mt-3">
        <ProGate feature="export" compact />
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-lg border border-border bg-border/20 p-3">
      <p className="text-xs font-bold tracking-wide text-primary mb-2">研究结果导出</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {TYPES.map((t) => (
          <div key={t.key} className="rounded-md border border-border/60 bg-card p-2.5 flex flex-col">
            <p className="text-[11px] font-semibold mb-1">{t.label}</p>
            <p className="text-[10px] text-muted leading-relaxed mb-2 flex-1">{t.desc}</p>
            <a
              href={`/api/pro/export?type=${t.key}`}
              onClick={() => setBusy(t.key)}
              className="text-[10px] text-center px-2 py-1 rounded border border-primary/30 bg-primary/8 text-primary hover:bg-primary/15"
            >
              {busy === t.key ? "已开始下载…" : "下载 CSV"}
            </a>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-muted leading-relaxed mt-2 border-t border-border/60 pt-2">
        每份 CSV 前几行是口径注释（窗口、样本数、因子权重、未纳入项），后面才是数据 ——
        导出的表会离开这个页面，没有口径的留档半年后就没人说得清这列怎么算出来的。
      </p>
    </div>
  );
}