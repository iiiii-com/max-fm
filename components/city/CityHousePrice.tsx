"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui";

/**
 * 城市房价指数卡片（国家统计局 70 城月度数据）。
 *
 * 三个必须遵守的展示纪律：
 *
 * 1. **这是指数不是价格**。基期 = 100，99.8 表示比上月低 0.2%，不是"房价 99.8"。
 *    所以这里显示的是「环比涨跌%」而不是价格，标签也写明"指数"。
 *
 * 2. **缺失的城市要说明原因**，不用近似值填。统计局 70 城是指定样本，
 *    站内 18 城（东莞 佛山 苏州等）不在范围内 —— 拿邻市或均价补一个数
 *    会制造假精确，比留空更糟。
 *
 * 3. **口径必须同屏可见**（官方注释）：市辖区不含县 / 新建为网签全面调查 /
 *    二手为重点+典型调查 / 2026-01 起以 2025 为新基期。
 *    只给数字不给口径，读者无法判断可比性。
 */

interface PriceRow {
  newMom: number;
  newYoy: number;
  usedMom: number;
  usedYoy: number;
}

interface Resp {
  ok: boolean;
  period: string | null;
  sourceUrl: string | null;
  cities: Record<string, PriceRow>;
}

const pct = (v: number) => `${v >= 100 ? "+" : ""}${((v - 100) / 1).toFixed(1)}%`;
const cls = (v: number) => (v >= 100 ? "up" : v < 100 ? "down" : "text-muted");

function Cell({ label, mom, yoy }: { label: string; mom: number; yoy: number }) {
  return (
    <div className="rounded-md border border-border px-2.5 py-2">
      <p className="text-[10px] text-muted mb-1">{label}</p>
      <p className="text-xs leading-tight">
        环比{" "}
        <span className={`font-mono font-semibold ${cls(mom)}`}>{pct(mom)}</span>
        <span className="text-muted"> · 同比 </span>
        <span className={`font-mono font-semibold ${cls(yoy)}`}>{pct(yoy)}</span>
      </p>
    </div>
  );
}

export default function CityHousePrice({ cityName }: { cityName: string }) {
  const [d, setD] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/city/house-price", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => !cancelled && setD(j))
      .catch(() => !cancelled && setD(null))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <div className="h-16 animate-pulse bg-muted/10 rounded-md" />;
  }

  if (!d?.ok) {
    return (
      <p className="text-[11px] text-muted">房价指数暂不可用（统计局接口未就绪）</p>
    );
  }

  const row = d.cities?.[cityName];

  if (!row) {
    return (
      <div className="rounded-md border border-border/60 bg-muted/10 p-3">
        <p className="text-[11px] text-muted leading-relaxed">
          <b>{cityName}</b> 不在国家统计局「70 个大中城市」房地产价格统计范围内。
          <br />
          该统计每年由统计局指定固定样本城市，<b>不是所有地级市都有</b>；
          此处不提供替代数值 —— 用邻市或全国均值填充会制造假精确。
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-baseline gap-2 flex-wrap">
        <p className="text-sm font-medium">商品住宅销售价格指数</p>
        <Badge tone="gray">{d.period ?? "期间未知"}</Badge>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Cell label="新建商品住宅" mom={row.newMom} yoy={row.newYoy} />
        <Cell label="二手住宅" mom={row.usedMom} yoy={row.usedYoy} />
      </div>
      <p className="text-[10px] text-muted leading-relaxed">
        指数以基期 = 100，上表显示的是相对涨跌百分比，<b>不是房价绝对值</b>。
        口径（国家统计局）：调查范围为市辖区、<b>不含县</b>；新建商品住宅为全面调查、
        基础数据取当地房地产管理部门网签；二手住宅为重点调查与典型调查相结合。
        2026 年 1 月起以 2025 年为新基期。
      </p>
      {d.sourceUrl && (
        <a
          href={d.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] text-primary hover:underline"
        >
          来源：国家统计局 70 个大中城市商品住宅销售价格变动情况 →
        </a>
      )}
    </div>
  );
}