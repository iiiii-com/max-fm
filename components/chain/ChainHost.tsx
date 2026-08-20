"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SectionTitle, Badge } from "@/components/ui";
import IndustryHeatCard from "@/components/IndustryHeatCard";
import { STATIC_CHAINS, getStaticChain } from "@/lib/data/chains";
import ChainDetail from "./ChainDetail";

const PROSP: Record<string, { label: string; tone: "red" | "amber" | "gray" | "blue" }> = {
  高景气: { label: "高景气", tone: "red" },
  中景气: { label: "中景气", tone: "amber" },
  低景气: { label: "低景气", tone: "gray" },
  分化: { label: "分化", tone: "blue" },
};

export interface DbChain {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  updatedAt: number | null;
}

export default function ChainHost({
  dbChains,
  nodeCounts,
  initialChain,
}: {
  dbChains: DbChain[];
  nodeCounts: Record<string, number>;
  initialChain?: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(
    initialChain && getStaticChain(initialChain) ? initialChain : null
  );

  const open = (slug: string) => {
    setSelected(slug);
    router.replace(`/industry?tab=chains&chain=${encodeURIComponent(slug)}`, { scroll: false });
  };
  const back = () => {
    setSelected(null);
    router.replace("/industry?tab=chains", { scroll: false });
  };

  const current = selected ? getStaticChain(selected) : undefined;
  if (current) {
    return <ChainDetail chain={current} onBack={back} />;
  }

  const newChains = STATIC_CHAINS.filter((c) => !dbChains.some((d) => d.slug === c.id));

  return (
    <>
      <section>
        <SectionTitle title="主线产业链" sub="点击卡片查看上中下游解剖与代表公司，底部标注板块当日热度与主力资金" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {dbChains.map((c) => (
            <IndustryHeatCard
              key={c.id}
              name={c.name}
              slug={c.slug}
              description={c.description}
              updatedAt={c.updatedAt}
              nodeCount={nodeCounts[c.id] ?? 0}
              onSelect={open}
            />
          ))}
        </div>
      </section>

      {newChains.length > 0 && (
        <section>
          <SectionTitle title="扩展产业链" sub="新增覆盖链（静态图谱数据）" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {newChains.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => open(c.id)}
                className="text-left h-full w-full"
              >
                <div className="card hover:shadow-md hover:border-primary/40 transition-all h-full p-4">
                  <div className="flex items-center justify-between mb-2">
                    <Badge tone="gray">{c.name}</Badge>
                    <Badge tone={PROSP[c.prosperity]?.tone ?? "gray"}>
                      {PROSP[c.prosperity]?.label ?? c.prosperity}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted">{c.marketSize ?? "规模数据整理中"}</p>
                  <p className="text-xs text-muted mt-2">
                    {c.segments.length} 段环节 · {c.segments.reduce((s, x) => s + x.companies.length, 0)} 家代表公司 → 查看上中下游解剖
                  </p>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}
    </>
  );
}