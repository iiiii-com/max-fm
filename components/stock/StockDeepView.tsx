"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Database, Scale, Building2, TrendingUp, Activity, FileText } from "lucide-react";
import ContextStrip from "@/components/ContextStrip";
import InteractiveKlineLab from "@/components/gmrds/InteractiveKlineLab";
import DepthPanel from "@/components/stock/DepthPanel";
import ValuationPercentile from "@/components/stock/ValuationPercentile";
import AnnouncementList from "@/components/stock/AnnouncementList";
import FlowBreakdown from "@/components/stock/FlowBreakdown";
import ScorePanel, { FlowPanel, type ScorePanelData, type FlowPanelData } from "@/components/ScorePanel";
import ValuationBand from "@/components/gmrds/ValuationBand";

interface Fund {
  name: string;
  code: string;
  price: number;
  pe: number | null;
  pb: number | null;
  eps: number | null;
  bps: number | null;
  totalMv: number | null;
  turnover: number | null;
}
interface FlowResp {
  flow: FlowPanelData | null;
  score: ScorePanelData | null;
}

/** 个股聚合深度页：K线 + 联动 + 财务 + 估值 + 评分资金流 */
export default function StockDeepView({ secid }: { secid: string }) {
  const isIndex = secid.startsWith("100.");
  const [bars, setBars] = useState<Array<{ date: string; open: number; close: number; high: number; low: number; volume: number }> | null>(null);
  const [fund, setFund] = useState<Fund | null>(null);
  const [flow, setFlow] = useState<FlowResp | null>(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!secid) return;
    let cancelled = false;
    setLoading(true);
    setErr("");
    const klineApi = isIndex ? "/api/index/kline" : "/api/stock/kline";
    Promise.all([
      fetch(`${klineApi}?secid=${secid}&days=250`, { cache: "no-store" }).then((r) => r.json()),
      isIndex ? Promise.resolve(null) : fetch(`/api/stock/fundamentals?secid=${secid}`, { cache: "no-store" }).then((r) => r.json()),
      isIndex ? Promise.resolve(null) : fetch(`/api/stock/flow?secid=${secid}`, { cache: "no-store" }).then((r) => r.json()),
    ])
      .then(([k, f, fl]) => {
        if (cancelled) return;
        if (Array.isArray(k?.klines) && k.klines.length) setBars(k.klines);
        else setErr(k?.error ?? "K 线数据加载失败");
        if (f?.ok && f.data) setFund(f.data);
        if (fl?.ok && fl.flow) setFlow({ flow: fl.flow, score: fl.score ?? null });
      })
      .catch((e) => !cancelled && setErr(e?.message ?? "加载失败"))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [secid]);

  const name = fund?.name ?? (secid.includes("100.") ? secid.split(".")[1] : "标的");

  // 浏览历史（localStorage，最近 8 个）
  const [history, setHistory] = useState<Array<{ secid: string; name: string }>>([]);
  useEffect(() => {
    if (!secid || !name || name === "标的") return;
    try {
      const key = "stock-history-v1";
      const arr = JSON.parse(localStorage.getItem(key) || "[]");
      const next = [{ secid, name }, ...arr.filter((x: any) => x.secid !== secid)].slice(0, 8);
      localStorage.setItem(key, JSON.stringify(next));
      setHistory(next);
    } catch {
      /* ignore */
    }
  }, [secid, name]);

  return (
    <div className="space-y-5">
      {history.length > 1 && (
        <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
          <span className="text-muted">最近查看：</span>
          {history.slice(1, 5).map((h) => (
            <Link key={h.secid} href={`/stock/${encodeURIComponent(h.secid)}`} className="px-2 py-0.5 rounded-full border border-border text-muted hover:text-primary hover:border-primary/50 transition-colors">
              {h.name}
            </Link>
          ))}
        </div>
      )}
      <Link href={`/market?tab=stocks&q=${encodeURIComponent(name)}`} className="inline-flex items-center gap-1 text-xs text-muted hover:text-primary transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" /> 返回行情
      </Link>

      <div className="flex items-baseline gap-3 flex-wrap">
        <h1 className="text-xl font-bold">{name}</h1>
        <span className="text-xs text-muted font-mono">{secid}</span>
        {fund?.price ? (
          <span className="text-lg font-bold font-mono">{fund.price.toFixed(2)}</span>
        ) : null}
        <span className="text-[11px] text-muted ml-auto">聚合深度页 · K线 / 联动 / 财务 / 估值 / 评分</span>
      </div>

      <ContextStrip name={name} pe={fund?.pe ?? null} />

      {loading ? (
        <p className="text-sm text-muted py-8 text-center">深度数据加载中…</p>
      ) : err && !bars ? (
        <p className="text-sm text-destructive py-8 text-center">{err}（请刷新重试或返回行情页）</p>
      ) : (
        <>
          {/* K 线（多周期 / 指标 / 回放 / 买卖点） */}
          <section>
            <h2 className="flex items-center gap-2 font-bold text-lg tracking-tight mb-2">
              <TrendingUp className="w-4.5 h-4.5 text-primary" /> K 线分析
            </h2>
            {bars?.length ? <InteractiveKlineLab data={bars} height={430} /> : <p className="text-sm text-muted">K 线数据暂不可用</p>}
          </section>

          {/* 盘口 · 分时 · 量能 */}
          <section>
            <h2 className="flex items-center gap-2 font-bold text-lg tracking-tight mb-2">
              <Activity className="w-4.5 h-4.5 text-primary" /> 盘口 · 分时 · 量能
            </h2>
            <DepthPanel secid={secid} flow={flow?.flow ?? null} />
          </section>

          {/* 评分 + 资金流 */}
          <section>
            <h2 className="flex items-center gap-2 font-bold text-lg tracking-tight mb-2">
              <Scale className="w-4.5 h-4.5 text-primary" /> 综合评分 · 资金流
            </h2>
            {flow ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {flow.score && <ScorePanel data={flow.score} loading={false} />}
                <div className="space-y-3">
                  {flow.flow && <FlowPanel data={flow.flow} />}
                  <FlowBreakdown flow={flow.flow} />
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted py-4">指数不适用个股评分，查看指数对比/全球热力。</p>
            )}
          </section>

          {/* 财务摘要 + 估值 */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <h2 className="flex items-center gap-2 font-bold text-lg tracking-tight mb-2">
                <Building2 className="w-4.5 h-4.5 text-primary" /> 财务摘要
              </h2>
              {fund ? (
                <div className="rounded-xl border border-border bg-card p-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[
                    ["市盈率 PE", fund.pe, "倍"],
                    ["市净率 PB", fund.pb, "倍"],
                    ["每股收益 EPS", fund.eps, "元"],
                    ["每股净资产 BPS", fund.bps, "元"],
                    ["总市值", fund.totalMv != null ? (fund.totalMv / 1e12).toFixed(2) + "万亿" : null, ""],
                    ["换手率", fund.turnover, "%"],
                  ].map(([label, val, unit]) => (
                    <div key={String(label)} className="rounded-lg bg-muted/20 px-3 py-2">
                      <p className="text-[10px] text-muted">{label}</p>
                      <p className="text-sm font-bold font-mono mt-0.5">{val ?? "—"}{val != null ? unit : ""}</p>
                    </div>
                  ))}
                  <p className="col-span-full text-[10px] text-muted leading-relaxed">
                    数据源：东方财富实时（2026-08 核验）。ROE/毛利率/三表趋势待财报接口接入（见 /gmrds/sources 来源核对清单）。
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted py-4">财务数据暂不可用（指数标的）</p>
              )}
            </div>
            <div>
              <h2 className="flex items-center gap-2 font-bold text-lg tracking-tight mb-2">
                <Database className="w-4.5 h-4.5 text-primary" /> 估值定位
              </h2>
              <ValuationBand
                items={[
                  {
                    name,
                    pe: fund?.pe ?? null,
                    band: [15, 30],
                    note: "当前 PE 为东方财富实时；通用合理区间 15-30 倍（行业差异见工具箱估值模块）",
                  },
                ]}
                title="当前 PE vs 合理区间"
                caption="图注：圆点=当前 PE（真实值），条形=合理区间。低于下限（绿）→ 低估区；高于上限（红）→ 高估区；区间内（蓝）→ 合理。区间为研究设定输入。"
              />
            </div>
          </section>

          {/* 估值分位（历史百分位） */}
          {!isIndex ? (
            <section>
              <h2 className="flex items-center gap-2 font-bold text-lg tracking-tight mb-2">
                <Database className="w-4.5 h-4.5 text-primary" /> 估值分位 · 近 5 年历史百分位
              </h2>
              <ValuationPercentile secid={secid} name={name} />
            </section>
          ) : null}

          {/* 公告聚合 */}
          {!isIndex ? (
            <section>
              <h2 className="flex items-center gap-2 font-bold text-lg tracking-tight mb-2">
                <FileText className="w-4.5 h-4.5 text-primary" /> 公告聚合
              </h2>
              <AnnouncementList secid={secid} />
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
