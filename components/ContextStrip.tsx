"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Landmark, Boxes, Scale, ArrowRight } from "lucide-react";

interface MacroCtx {
  stage: string;
  score: number;
  equityPref: string;
  summary: string;
}

/**
 * 数据联动条：宏观环境 → 行业景气 → 估值定位（板块间有机流动）
 * 个股详情顶部显示三层上下文，点击跳转对应板块（GMRDS 体系 / 产业链 / 估值工具箱）
 */
export default function ContextStrip({
  name,
  pe,
}: {
  name: string;
  pe: number | null;
}) {
  const [macro, setMacro] = useState<MacroCtx | null>(null);
  const [macroErr, setMacroErr] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/macro/context", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled) {
          if (j?.ok) setMacro(j.macro);
          else setMacroErr(true);
        }
      })
      .catch(() => !cancelled && setMacroErr(true));
    return () => { cancelled = true; };
  }, []);

  // 行业景气（简化口径）：PE 相对通用中枢判断 —— 白酒/消费类高 PE 常态，标注为参考
  let industry: { label: string; detail: string; tone: string; href: string } = { label: "行业景气观察", detail: "PE 相对历史中枢定位", tone: "text-muted", href: "/industry" };
  if (pe !== null) {
    if (pe < 15) { industry = { label: "行业景气 · 价值区", detail: `PE ${pe.toFixed(1)} 低于 15 倍中枢，行业估值偏冷（关注拐点）`, tone: "text-emerald-600", href: "/industry" }; }
    else if (pe <= 30) { industry = { label: "行业景气 · 均衡", detail: `PE ${pe.toFixed(1)} 处于 15-30 倍中枢区间，行业热度中性`, tone: "text-foreground", href: "/industry" }; }
    else { industry = { label: "行业景气 · 高热度", detail: `PE ${pe.toFixed(1)} 高于 30 倍中枢，行业受资金追捧（警惕拥挤）`, tone: "text-red-600", href: "/industry" }; }
  }

  // 估值定位（环节 6）
  let valuation: { label: string; detail: string; tone: string } = { label: "估值定位", detail: "通用 PE 中枢 15-30 倍", tone: "text-muted" };
  if (pe !== null) {
    if (pe < 15) valuation = { label: "低估区", detail: `PE ${pe.toFixed(1)} < 15 倍下限，安全边际充足`, tone: "text-emerald-600" };
    else if (pe <= 30) valuation = { label: "合理区", detail: `PE ${pe.toFixed(1)} 位于 15-30 倍合理区间`, tone: "text-foreground" };
    else valuation = { label: "高估区", detail: `PE ${pe.toFixed(1)} > 30 倍上限，估值偏贵`, tone: "text-red-600" };
  }

  const cards = [
    {
      icon: Landmark,
      title: "宏观环境",
      sub: macro ? `${macro.stage} · 评分 ${macro.score}` : macroErr ? "数据受限" : "计算中…",
      detail: macro?.summary ?? "上证近 1 年表现驱动（真实数据自算）",
      href: "/gmrds",
      tone: macro ? (macro.score >= 60 ? "text-red-600" : macro.score >= 45 ? "text-foreground" : "text-emerald-600") : "text-muted",
      ready: !!macro && !macroErr,
    },
    {
      icon: Boxes,
      title: "行业景气",
      sub: industry.label,
      detail: industry.detail,
      href: industry.href,
      tone: industry.tone,
      ready: pe !== null,
    },
    {
      icon: Scale,
      title: "估值定位",
      sub: valuation.label,
      detail: valuation.detail + "（通用口径，随行业调整）",
      href: "/gmrds/toolkit#valuation",
      tone: valuation.tone,
      ready: pe !== null,
    },
  ];

  return (
    <div className="rounded-xl border border-border bg-card p-3 mb-3">
      <p className="text-[11px] font-bold text-muted mb-2 flex items-center gap-1.5">
        数据联动 · {name} 的上下文
        <span className="text-[10px] font-normal">（宏观 → 行业 → 标的，板块间流动）</span>
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {cards.map((c) => (
          <Link
            key={c.title}
            href={c.href}
            className="rounded-lg border border-border px-3 py-2 hover:bg-muted/20 hover:shadow-sm transition-all group"
          >
            <p className="flex items-center gap-1.5 text-xs font-bold">
              <c.icon className="w-3.5 h-3.5 text-primary" /> {c.title}
              <ArrowRight className="w-3 h-3 text-muted opacity-0 group-hover:opacity-100 transition-opacity ml-auto" />
            </p>
            <p className={`text-[11px] font-bold mt-0.5 ${c.ready ? c.tone : "text-muted"}`}>
              {c.sub}
            </p>
            <p className="text-[10px] text-muted leading-snug mt-0.5 line-clamp-2">{c.detail}</p>
          </Link>
        ))}
      </div>
      <p className="text-[10px] text-muted mt-2 leading-relaxed">
        口径：宏观由上证近 1 年涨跌 / 250 日线 / 年化波动真实数据自算（环节 1+3）；行业与估值基于标的 PE 相对通用中枢 15-30 倍定位（环节 4+6），
        具体行业阈值见 /gmrds/toolkit。点击卡片进入对应板块。
      </p>
    </div>
  );
}
