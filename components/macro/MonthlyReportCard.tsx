"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Card, Badge, SectionTitle, AIFlag } from "@/components/ui";
import { fmtDate } from "@/lib/utils";

interface MonthlyArticle {
  slug: string;
  title: string;
  summary: string | null;
  publishDate: string | null;
  updatedAt: number | null;
  sourceModel: string | null;
}

interface MonthlyStatus {
  ok: boolean;
  ym: string;
  monthLabel: string;
  hasAI: boolean;
  article: MonthlyArticle | null;
  history: Array<{ slug: string; ym: string; title: string; summary: string | null; publishDate: string | null; sourceModel: string | null }>;
}

function ymLabel(ym: string): string {
  const m = ym.match(/^(\d{4})-(\d{2})$/);
  return m ? `${m[1]} 年 ${Number(m[2])} 月` : ym;
}

/**
 * AI 宏观月报卡片。
 *
 * 旧实现只把 DB 里第一条 monthly 文章贴出来，既不校验是不是当月、也没有
 * 历史月报入口，用户看到的是「某个月的旧文章」，没法确认「本月准时更新了没有」。
 * 现在显式区分：本月已有 / 本月待生成（可立即生成）/ 历史月报。
 */
export default function MonthlyReportCard() {
  const [status, setStatus] = useState<MonthlyStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/macro/monthly", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error ?? "月报状态加载失败");
      setStatus(json);
      setError("");
    } catch (e: any) {
      setError(e?.message ?? "月报状态加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const generate = async () => {
    setGenerating(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/macro/monthly", { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error ?? "生成失败");
      setNotice(json.message ?? "已生成");
      await load();
    } catch (e: any) {
      setError(e?.message ?? "生成失败");
    } finally {
      setGenerating(false);
    }
  };

  const current = status?.article ?? null;
  const history = (status?.history ?? []).filter((h) => h.ym !== status?.ym);

  return (
    <section id="report">
      <SectionTitle
        title="AI 月度报告"
        sub="每月自动更新：固定 cron（每月 1 日随每日任务自动生成）+ 页面兜底生成，按月份唯一落库；数据覆盖 24 项宏观指标 + 宏观温度三因子 + 体感温差"
        extra={<AIFlag />}
      />

      {loading ? (
        <Card>
          <div className="h-20 animate-pulse bg-muted/10 rounded-lg" aria-busy="true" />
        </Card>
      ) : error && !status ? (
        <Card>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm text-muted">{error}</p>
            <button
              type="button"
              onClick={load}
              className="px-3 py-1.5 rounded-lg border border-border text-xs hover:border-primary/50"
            >
              重试
            </button>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {current ? (
            <Card className="transition-shadow">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <Badge>本月月报</Badge>
                <Badge tone="green">{ymLabel(status!.ym)} 已更新</Badge>
                <span className="text-xs text-muted">{fmtDate(current.publishDate)}</span>
                <span className="text-[11px] text-muted ml-auto">
                  {current.sourceModel === "template" ? "数据模板（AI 未配置/调用失败）" : "AI 生成"}
                </span>
              </div>
              <Link href={`/article/${current.slug}`} className="group block">
                <h3 className="font-bold text-lg group-hover:text-primary">{current.title}</h3>
                <p className="text-sm text-muted mt-1 line-clamp-2">{current.summary}</p>
                <p className="text-xs text-primary mt-2">阅读完整月报 →</p>
              </Link>
              {current.sourceModel === "template" && status?.hasAI ? (
                <div className="mt-3 pt-3 border-t border-border/60 flex items-center justify-between gap-3 flex-wrap">
                  <p className="text-[11px] text-muted">检测到 AI 已就绪：可把这份数据模板升级为 AI 深度解读（覆盖同月内容，不产生重复）。</p>
                  <button
                    type="button"
                    onClick={generate}
                    disabled={generating}
                    className="px-3 py-1.5 rounded-lg border border-primary/40 text-primary text-xs font-medium disabled:opacity-60 shrink-0"
                  >
                    {generating ? "生成中…" : "升级为 AI 版"}
                  </button>
                </div>
              ) : null}
            </Card>
          ) : (
            <Card>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <Badge tone="amber">本月待生成</Badge>
                    <span className="text-xs text-muted">{ymLabel(status?.ym ?? "")}</span>
                  </div>
                  <p className="text-sm text-muted leading-relaxed">
                    本月月报将在每月 1 日由定时任务自动生成；如果定时任务未跑到（如部署平台 cron 额度限制），
                    点右侧按钮即可立即生成本月月报（已存在时不会重复调用 AI）。
                  </p>
                  <p className="text-[11px] text-muted mt-1">
                    数据源：站内 24 项宏观指标序列 + 宏观温度（PMI/CPI/M2 三因子）+ 体感问卷均值。
                  </p>
                </div>
                <button
                  type="button"
                  onClick={generate}
                  disabled={generating}
                  className="px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-medium disabled:opacity-60 shrink-0"
                >
                  {generating ? "生成中…" : "立即生成本月月报"}
                </button>
              </div>
            </Card>
          )}

          {notice ? <p className="text-xs text-primary">{notice}</p> : null}
          {error && status ? <p className="text-xs text-amber-600">{error}</p> : null}

          {history.length ? (
            <Card className="p-0 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
                <p className="text-sm font-bold">历史月报</p>
                <span className="text-[11px] text-muted">{history.length} 期</span>
              </div>
              <ul className="divide-y divide-border/60">
                {history.map((h) => (
                  <li key={h.slug}>
                    <Link
                      href={`/article/${h.slug}`}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-primary/5"
                    >
                      <span className="text-xs font-mono text-muted w-24 shrink-0">{ymLabel(h.ym)}</span>
                      <span className="text-sm truncate flex-1">{h.title}</span>
                      <span className="text-[11px] text-muted shrink-0">{fmtDate(h.publishDate)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>
      )}
    </section>
  );
}
