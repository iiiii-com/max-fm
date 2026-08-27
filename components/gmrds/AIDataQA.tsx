"use client";

import { useState } from "react";
import { Send, Sparkles, MessageSquareText } from "lucide-react";

const EXAMPLES = ["贵州茅台贵不贵", "上证指数最近走势", "恒生指数估值", "标普500表现", "宁德时代"];

interface Target {
  name: string;
  secid: string;
  price: number | null;
  changePct: number | null;
  pe: number | null;
  pb: number | null;
  eps: number | null;
  totalMv: number | null;
  monthChg: number | null;
  verdict: string;
}

/** 站内数据问答：自然语言 → 真实数据答案（估值/行情/表现） */
export default function AIDataQA() {
  const [q, setQ] = useState("");
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState("");
  const [targets, setTargets] = useState<Target[]>([]);
  const [err, setErr] = useState("");

  const ask = async (text: string) => {
    const t = text.trim();
    if (!t || asking) return;
    setQ(t);
    setAsking(true);
    setErr("");
    setAnswer("");
    setTargets([]);
    try {
      const res = await fetch(`/api/ai/answer?q=${encodeURIComponent(t)}`, { cache: "no-store" });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error ?? "问答失败");
      setAnswer(j.answer ?? "");
      setTargets(j.targets ?? []);
      if (j.type === "not-found") setErr("未找到对应标的，试试示例问题");
    } catch (e: any) {
      setErr(e?.message ?? "问答服务暂不可用");
    } finally {
      setAsking(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* 输入区 */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <MessageSquareText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && ask(q)}
            placeholder="输入问题：如「贵州茅台贵不贵」「上证指数最近走势」"
            className="w-full rounded-lg border border-border bg-background pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
        <button
          onClick={() => ask(q)}
          disabled={asking}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {asking ? "分析中…" : "提问"}
          <Send className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 示例 */}
      <div className="flex flex-wrap gap-1.5">
        <span className="text-[10px] text-muted self-center">试试：</span>
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            onClick={() => ask(ex)}
            className="px-2 py-0.5 rounded-full border border-border text-[11px] text-muted hover:text-primary hover:border-primary/50 transition-colors"
          >
            {ex}
          </button>
        ))}
      </div>

      {err && <p className="text-xs text-destructive">{err}</p>}

      {/* 答案 */}
      {answer && (
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="flex items-center gap-1.5 text-xs font-bold text-primary mb-2">
            <Sparkles className="w-3.5 h-3.5" /> 数据问答 · 基于站内真实数据
          </p>
          <p className="text-sm leading-relaxed whitespace-pre-line">{answer}</p>

          {targets.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-3">
              {targets.map((t) => (
                <a
                  key={t.secid}
                  href={`/stock/${encodeURIComponent(t.secid)}`}
                  className="rounded-lg border border-border/70 px-3 py-2 hover:bg-muted/20 transition-colors"
                >
                  <p className="text-xs font-bold">{t.name} <span className="text-[10px] text-muted font-mono">{t.secid}</span></p>
                  <p className="text-[11px] text-muted mt-0.5">
                    {t.price != null ? `现价 ${t.price.toFixed(2)}` : ""}
                    {t.changePct != null ? ` · ${t.changePct >= 0 ? "+" : ""}${t.changePct.toFixed(2)}%` : ""}
                    {t.monthChg != null ? ` · 近1月${t.monthChg >= 0 ? "+" : ""}${t.monthChg.toFixed(1)}%` : ""}
                  </p>
                  <p className="text-[10px] mt-1" style={{ color: t.pe != null && t.pe > 30 ? "#d7000b" : t.pe != null && t.pe < 15 ? "#0aa06e" : "#475569" }}>
                    {t.verdict}
                  </p>
                </a>
              ))}
            </div>
          )}
          <p className="text-[10px] text-muted mt-2">答案由真实行情/财务/宏观数据实时生成（非模型推测）；点击目标卡进入聚合深度页。仅供研究参考，不构成投资建议。</p>
        </div>
      )}
    </div>
  );
}
