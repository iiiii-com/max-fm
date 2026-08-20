"use client";

import { useEffect } from "react";
import Link from "next/link";
import { CITY_RANK, STATIC_REGIONS, type CityInfo, type StaticRegion } from "@/lib/data/regions";
import { matchChainId } from "@/lib/data/chains";
import { Badge } from "@/components/ui";

export interface DrawerCity {
  name: string;
}

function findCity(name: string): {
  rank?: (typeof CITY_RANK)[number];
  rankNo: number;
  region?: StaticRegion;
  info?: CityInfo;
} {
  const rankNo = CITY_RANK.findIndex((c) => c.name === name);
  const rank = rankNo >= 0 ? CITY_RANK[rankNo] : undefined;
  const region = STATIC_REGIONS.find((r) => r.cities.some((c) => c.name === name));
  const info = region?.cities.find((c) => c.name === name);
  return { rank, rankNo: rankNo + 1, region, info };
}

const tagHref = (tag: string) => {
  const id = matchChainId(tag);
  return id ? `/industry?tab=chains&chain=${encodeURIComponent(id)}` : "/industry?tab=chains";
};

export default function CityDrawer({ city, onClose }: { city: DrawerCity | null; onClose: () => void }) {
  useEffect(() => {
    if (!city) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [city, onClose]);

  if (!city) return null;

  const { rank, rankNo, region, info } = findCity(city.name);

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div className="absolute inset-y-0 right-0 w-full max-w-[560px] bg-background border-l border-border shadow-2xl overflow-y-auto">
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-3 bg-background/95 backdrop-blur border-b border-border">
          <div className="flex items-center gap-2">
            <p className="font-bold text-lg">{city.name}</p>
            {rankNo > 0 && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary font-mono">
                全国第 {rankNo}
              </span>
            )}
            {region && <Badge tone="blue">{region.zone}</Badge>}
          </div>
          <button onClick={onClose} className="text-sm px-2 py-1 rounded-md border border-border hover:border-primary/50" aria-label="关闭">
            ✕
          </button>
        </div>

        <div className="p-5 space-y-5">
          {rank && (
            <div className="grid grid-cols-2 gap-3">
              <div className="card p-3">
                <p className="text-[11px] text-muted">GDP（2025 预估）</p>
                <p className="font-bold text-lg font-mono">{rank.gdp}</p>
              </div>
              <div className="card p-3">
                <p className="text-[11px] text-muted">上市公司数</p>
                <p className="font-bold text-lg font-mono">{rank.listed} 家</p>
              </div>
            </div>
          )}

          {region && (
            <div className="card p-4">
              <p className="text-xs text-muted mb-1">
                所属省份：<span className="font-medium text-foreground">{region.province}</span>
              </p>
              <p className="text-xs text-muted">{region.position}</p>
            </div>
          )}

          {info && (
            <>
              <div>
                <p className="text-sm font-medium mb-2">支柱产业</p>
                <div className="flex flex-wrap gap-1.5">
                  {info.pillar.map((t) => (
                    <Link
                      key={`p-${t}`}
                      href={tagHref(t)}
                      onClick={onClose}
                      className="text-xs px-2 py-1 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                    >
                      {t} →
                    </Link>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm font-medium mb-2">优势产业</p>
                <div className="flex flex-wrap gap-1.5">
                  {info.advantage.map((t) => (
                    <Link
                      key={`a-${t}`}
                      href={tagHref(t)}
                      onClick={onClose}
                      className="text-xs px-2 py-1 rounded-md bg-sky-500/10 text-sky-600 dark:text-sky-400 hover:bg-sky-500/20 transition-colors"
                    >
                      {t} →
                    </Link>
                  ))}
                </div>
              </div>
              {info.companies.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">代表企业</p>
                  <div className="flex flex-wrap gap-1.5">
                    {info.companies.map((n) => (
                      <span key={n} className="text-xs px-2 py-1 rounded-md border border-border text-muted">
                        {n}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {rank?.note && <p className="text-[11px] text-muted">{rank.note}</p>}
        </div>
      </div>
    </div>
  );
}