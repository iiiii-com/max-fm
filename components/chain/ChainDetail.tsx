"use client";

import Link from "next/link";
import { Card, Badge, SectionTitle } from "@/components/ui";
import { STATIC_REGIONS } from "@/lib/data/regions";
import { matchChainId, type StaticChain } from "@/lib/data/chains";
import ChainFlow from "./ChainFlow";

const PROSP: Record<string, { label: string; tone: "red" | "amber" | "gray" | "blue" }> = {
  高景气: { label: "高景气", tone: "red" },
  中景气: { label: "中景气", tone: "amber" },
  低景气: { label: "低景气", tone: "gray" },
  分化: { label: "分化", tone: "blue" },
};

const STAGE_TONE: Record<string, "red" | "amber" | "gray" | "blue" | "purple" | "cyan"> = {
  上游: "cyan",
  中游: "red",
  下游: "purple",
};

export default function ChainDetail({ chain, onBack }: { chain: StaticChain; onBack: () => void }) {
  const spots = STATIC_REGIONS.flatMap((r) =>
    r.cities.flatMap((c) => {
      const tags = [...c.pillar, ...c.advantage].filter((t) => matchChainId(t) === chain.id);
      return tags.length ? [{ province: r.province, city: c.name, tags }] : [];
    })
  );

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="text-sm text-primary hover:underline cursor-pointer">
        ← 返回产业链列表
      </button>

      <header className="card p-4 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-xl md:text-2xl font-bold">{chain.name}</h2>
          <Badge tone={PROSP[chain.prosperity]?.tone ?? "gray"}>
            {PROSP[chain.prosperity]?.label ?? chain.prosperity}
          </Badge>
          {chain.marketSize && <Badge tone="gray">{chain.marketSize}</Badge>}
          <span className="text-xs text-muted ml-auto">{chain.segments.length} 段环节 · 上中下游解剖</span>
        </div>
        {chain.outlook && <p className="text-sm text-muted">展望：{chain.outlook}</p>}
      </header>

      <ChainFlow chain={chain} />

      <section>
        <SectionTitle title="环节卡片" sub="点击公司名跳转行情查询" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {chain.segments.map((seg) => (
            <Card key={seg.stage + seg.name} className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Badge tone={STAGE_TONE[seg.stage] ?? "gray"}>{seg.stage}</Badge>
                <h3 className="font-bold">{seg.name}</h3>
              </div>
              <p className="text-xs text-muted leading-relaxed">{seg.products}</p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {seg.companies.map((c) => (
                  <Link
                    key={c.name}
                    href={`/stock?q=${encodeURIComponent(c.name)}`}
                    className="text-xs px-2 py-0.5 rounded bg-border/40 hover:bg-primary/10 hover:text-primary transition-colors"
                  >
                    {c.name}
                  </Link>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <SectionTitle title="重点分布省市" sub="依据支柱/优势产业匹配 · 点击跳转经济分布图" />
        {spots.length ? (
          <div className="flex flex-wrap gap-2">
            {spots.map((s, i) => (
              <Link
                key={`${s.province}-${s.city}-${i}`}
                href="/map"
                className="text-xs px-2.5 py-1 rounded-md border border-border hover:border-primary/60 hover:text-primary transition-colors"
              >
                {s.province} · {s.city}（{s.tags.join(" / ")}）
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">暂无省市数据</p>
        )}
      </section>
    </div>
  );
}