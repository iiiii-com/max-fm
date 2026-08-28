"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, Badge } from "@/components/ui";
import { fmtDate } from "@/lib/utils";
import { CHAIN_IMPACT } from "@/lib/data/crisis/chainImpact";

function findImpact(name: string): string[] | null {
  if (CHAIN_IMPACT[name]) return CHAIN_IMPACT[name];
  const hit = Object.entries(CHAIN_IMPACT).find(([k]) => name.includes(k) || k.includes(name));
  return hit ? hit[1] : null;
}

interface SectorRow {
  code: string;
  name: string;
  changePct: number;
  mainNetIn: number;
}

let sectorCache: SectorRow[] | null = null;
let sectorPromise: Promise<SectorRow[]> | null = null;

function fmtMoney(n: number) {
  if (Math.abs(n) >= 1e8) return `${(n / 1e8).toFixed(2)}亿`;
  if (Math.abs(n) >= 1e4) return `${(n / 1e4).toFixed(0)}万`;
  return String(n);
}

function loadSectors(): Promise<SectorRow[]> {
  if (sectorCache) return Promise.resolve(sectorCache);
  if (!sectorPromise) {
    sectorPromise = fetch("/api/sector/board?top=60", { cache: "no-store" })
      .then((res) => res.json())
      .then((j) => {
        sectorCache = Array.isArray(j?.list) ? (j.list as SectorRow[]) : [];
        return sectorCache;
      })
      .catch(() => {
        sectorCache = [];
        return sectorCache;
      });
  }
  return sectorPromise;
}

export default function IndustryHeatCard({
  name,
  slug,
  description,
  updatedAt,
  nodeCount,
  onSelect,
}: {
  name: string;
  slug: string;
  description: string | null;
  updatedAt: number | null;
  nodeCount: number;
  onSelect?: (slug: string) => void;
}) {
  const [s, setS] = useState<SectorRow | null>(null);
  const [loaded, setLoaded] = useState(false);
  const impact = findImpact(name);

  useEffect(() => {
    let alive = true;
    loadSectors().then((sectors) => {
      if (!alive) return;
      const hit = sectors.find((x) => x.name.includes(name) || name.includes(x.name));
      setS(hit ?? null);
      setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, [name]);

  const inner = (
    <Card className="hover:shadow-md hover:border-primary/40 transition-all h-full">
      <div className="flex items-center justify-between mb-2">
        <Badge tone={name.includes("AI") || name.includes("半导体") ? "amber" : "red"}>{name}</Badge>
        <span className="text-xs text-muted">更新于 {fmtDate(updatedAt ? new Date(updatedAt).toLocaleDateString("zh-CN") : "—")}</span>
      </div>
      <p className="text-sm text-muted line-clamp-3">{description}</p>
      <div className="flex items-center gap-2 text-xs mt-2">
        <Badge tone={s ? (s.changePct >= 0 ? "red" : "green") : "gray"}>
          {s ? `${s.changePct >= 0 ? "+" : ""}${s.changePct.toFixed(2)}%` : "—"}
        </Badge>
        <span className={`font-mono ${(s?.mainNetIn ?? 0) >= 0 ? "up" : "down"}`}>
          {s ? `主力 ${fmtMoney(s.mainNetIn)}` : loaded ? "暂无板块行情" : "加载中…"}
        </span>
      </div>
      <p className="text-xs text-muted mt-2">{nodeCount} 个环节 · 查看上下游解剖 →</p>
      {impact && (
        <p className="text-[11px] text-muted mt-2 leading-relaxed">
          <span className="font-medium text-primary">历史冲击：</span>{impact[0]}
        </p>
      )}
    </Card>
  );

  if (onSelect) {
    return (
      <button type="button" onClick={() => onSelect(slug)} className="text-left w-full">
        {inner}
      </button>
    );
  }
  return <Link href={`/industry/${slug}`}>{inner}</Link>;
}