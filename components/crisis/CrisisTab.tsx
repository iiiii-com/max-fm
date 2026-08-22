"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge, SectionTitle } from "@/components/ui";
import { CRISES } from "@/lib/data/crisis/crises";
import type { Crisis } from "@/lib/data/crisis/types";
import CrisisEngine from "./CrisisEngine";
import BullBearKline from "./BullBearKline";
import BullBearEvents from "./BullBearEvents";
import BullBearCompare from "@/components/BullBearCompare";

const LEVEL_META: Record<Crisis["level"], { label: string; tone: "red" | "blue" | "gray"; order: number }> = {
  major: { label: "特大危机", tone: "red", order: 0 },
  standard: { label: "标准危机", tone: "blue", order: 1 },
  brief: { label: "简版", tone: "gray", order: 2 },
};

const LEVEL_FILTERS = [
  { key: "all", label: "全部" },
  { key: "major", label: "特大危机" },
  { key: "standard", label: "标准危机" },
  { key: "brief", label: "简版" },
] as const;

const DURATION_FILTERS = [
  { key: "all", label: "任意时长" },
  { key: "s", label: "≤1 年" },
  { key: "m", label: "1~2 年" },
  { key: "l", label: "≥2 年" },
] as const;

function durationMonths(c: Crisis): number {
  const d0 = new Date(c.period[0]).getTime();
  const d1 = new Date(c.period[1]).getTime();
  return Math.max(1, Math.round((d1 - d0) / (30.44 * 24 * 3600 * 1000)));
}

export default function CrisisTab() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [level, setLevel] = useState<(typeof LEVEL_FILTERS)[number]["key"]>("all");
  const [dur, setDur] = useState<(typeof DURATION_FILTERS)[number]["key"]>("all");
  const crisis = selectedId ? CRISES.find((c) => c.id === selectedId) : undefined;

  const filtered = useMemo(
    () =>
      [...CRISES]
        .filter((c) => (level === "all" ? true : c.level === level))
        .filter((c) => {
          const m = durationMonths(c);
          if (dur === "s") return m <= 12;
          if (dur === "m") return m > 12 && m < 24;
          if (dur === "l") return m >= 24;
          return true;
        })
        .sort(
          (a, b) =>
            LEVEL_META[a.level].order - LEVEL_META[b.level].order || a.period[0].localeCompare(b.period[0]),
        ),
    [level, dur],
  );

  if (crisis) {
    return <CrisisEngine key={crisis.id} crisis={crisis} onExit={() => setSelectedId(null)} />;
  }

  const quizCount = (c: Crisis) => c.nodes.filter((n) => n.quiz).length;

  const chip = (
    active: boolean,
    onClick: () => void,
    label: string,
  ) => (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-full border text-xs transition-colors ${
        active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted hover:border-primary/40"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-8">
      {/* 牛熊深度对比全景：真实 K 线 + 全维度对照 */}
      <section>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <SectionTitle
            title="牛熊深度对比"
            sub="上证综指 1990-2026 真实历史行情 · 21 轮牛熊的启动/见顶/见底标注 · 关键事件融入 K 线 · 涨跌幅 / 回撤 / 天量地量 / 估值 / 情绪全维度量化"
          />
          <Link
            href="/analysis/bullbear"
            className="text-xs px-3 py-1.5 rounded-lg border border-primary/40 text-primary hover:bg-primary/10 transition-colors shrink-0"
          >
            深度分析报告（含美股对比）→
          </Link>
        </div>
        <BullBearKline />
      </section>

      <section>
        <SectionTitle
          title="牛熊关键事件 · 深度解读"
          sub="每一轮牛熊的转折事件独立成卡，分析政策/制度/宏观/外部事件如何推动上涨、下跌与回调"
        />
        <BullBearEvents />
      </section>

      <section>
        <BullBearCompare />
      </section>

      <section>
        <SectionTitle
          title="危机重演 · 亲历关键时点"
          sub={`回到危机前夜：K 线回放 + 虚拟账户 + 决策测验，共 ${CRISES.length} 场`}
        />
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span className="text-xs text-muted">级别</span>
          {LEVEL_FILTERS.map((f) => (
            <span key={f.key}>{chip(level === f.key, () => setLevel(f.key), f.label)}</span>
          ))}
          <span className="text-xs text-muted ml-3">时长</span>
          {DURATION_FILTERS.map((f) => (
            <span key={f.key}>{chip(dur === f.key, () => setDur(f.key), f.label)}</span>
          ))}
          <span className="text-xs text-muted ml-auto">{filtered.length} 场</span>
        </div>
        {filtered.length === 0 ? (
          <div className="card p-8 text-center text-sm text-muted">没有符合筛选条件的危机</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className="text-left card p-5 hover:shadow-md hover:border-primary/40 transition-all"
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h3 className="font-bold text-sm leading-snug">{c.title}</h3>
                  <Badge tone={LEVEL_META[c.level].tone}>{LEVEL_META[c.level].label}</Badge>
                </div>
                <p className="text-xs text-muted font-mono mb-2">
                  {c.period[0]} ~ {c.period[1]} · 约 {durationMonths(c)} 个月
                </p>
                <p className="text-xs text-muted mb-2">
                  {c.markets.map((m) => m.name).join(" · ")}
                </p>
                <p className="text-[11px] text-muted">
                  {c.nodes.length} 个节点
                  {quizCount(c) > 0 && ` · ${quizCount(c)} 道决策题`}
                  {c.snapshotData ? " · 内置快照" : ""}
                </p>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}