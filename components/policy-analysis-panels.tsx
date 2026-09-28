"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui";
import Markdown from "@/components/markdown";

/**
 * 政策三层解读面板（按需生成）
 *
 * 修复：此前这块是服务端渲染的静态占位 —— 没有 analysis 记录就永远显示
 * 「分析生成中 / 数据关联生成中」，而站内根本不存在生成该解读的接口，
 * 读者会一直等一个不会到来的结果。现在：
 *  - 无解读时显示「尚未生成」+ 明确的「生成解读」按钮（而不是无限 loading 文案）；
 *  - 点击后调用 /api/policy/[id]/analysis，成功即就地渲染；
 *  - AI 未配置 / 调用失败时，把原因如实显示出来，不用通用模板顶替。
 */
export function PolicyAnalysisPanels({
  id,
  popular,
  professional,
  detail,
  dataLinks,
  sectorHits,
}: {
  id: string;
  popular: string | null;
  professional: string | null;
  detail: string | null;
  dataLinks: string | null;
  sectorHits: Array<{ label: string; slug: string }>;
}) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [errMsg, setErrMsg] = useState("");
  const [links, setLinks] = useState<string[] | null>(null);

  const ready = !!popular && !!professional;
  const parsedLinks = (() => {
    if (!dataLinks) return [] as string[];
    try {
      const v = JSON.parse(dataLinks);
      return Array.isArray(v) ? v.map(String) : [];
    } catch {
      return [];
    }
  })();
  const showLinks = links ?? parsedLinks;

  async function generate() {
    setState("loading");
    setErrMsg("");
    try {
      const res = await fetch("/api/policy/" + encodeURIComponent(id) + "/analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const j = await res.json();
      if (!res.ok || !j?.ok) {
        setErrMsg(j?.hint || j?.error || "生成失败");
        setState("error");
        return;
      }
      setLinks(j?.analysis?.dataLinks ? JSON.parse(j.analysis.dataLinks) : []);
      setState("idle");
      router.refresh();
    } catch {
      setErrMsg("网络异常，请稍后重试");
      setState("error");
    }
  }

  if (!ready) {
    return (
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-3 card p-6">
          <h2 className="font-bold mb-2">AI 解读</h2>
          <p className="text-sm text-muted leading-relaxed">
            这条政策<b className="text-foreground">尚未生成解读</b>。本站不提供与政策内容无关的通用模板兜底
            （那样的「解读」对任何政策都长得一样，会造成误导），因此未生成时如实留空。
          </p>
          <div className="flex items-center gap-3 mt-4 flex-wrap">
            <button
              onClick={generate}
              disabled={state === "loading"}
              className="px-4 py-1.5 rounded-lg bg-primary text-white text-sm hover:opacity-90 disabled:opacity-50"
            >
              {state === "loading" ? "生成中…（约 10–30 秒）" : "生成解读"}
            </button>
            {state === "error" && (
              <span className="text-xs text-red-600 dark:text-red-400">{errMsg}</span>
            )}
          </div>
          {sectorHits.length > 0 && (
            <p className="text-xs text-muted mt-4 leading-relaxed">
              关键词命中的相关产业链：{sectorHits.map((s) => s.label).join("、")}
              （关键词匹配结果，不代表该政策会利好这些行业）
            </p>
          )}
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card p-4">
          <h2 className="font-bold mb-2">普通人怎么看</h2>
          <div className="prose-sm"><Markdown content={popular!} /></div>
        </div>
        <div className="card p-4">
          <h2 className="font-bold mb-2">专业解读</h2>
          <div className="prose-sm"><Markdown content={professional!} /></div>
        </div>
        <div className="card p-4">
          <h2 className="font-bold mb-2">趋势与风险</h2>
          {detail ? (
            <div className="prose-sm"><Markdown content={detail} /></div>
          ) : (
            <p className="text-sm text-muted">该政策未产出趋势与风险判断</p>
          )}
        </div>
      </section>

      {showLinks.length > 0 && (
        <section>
          <div className="card p-4">
            <h2 className="font-bold mb-2">关联指标</h2>
            <div className="flex flex-wrap gap-2">
              {showLinks.map((d) => (
                <Badge key={d} tone="gray">{d}</Badge>
              ))}
            </div>
            <p className="text-xs text-muted mt-3">由 AI 从站内真实指标清单中选取，可点击指标名查看走势。</p>
          </div>
        </section>
      )}
    </>
  );
}
