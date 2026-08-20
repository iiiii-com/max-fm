"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CITY_RANK, STATIC_REGIONS } from "@/lib/data/regions";
import { matchChainId } from "@/lib/data/chains";
import { Badge } from "@/components/ui";
import CityDrawer from "@/components/CityDrawer";

type SortKey = "rank" | "gdp" | "listed";

const gdpNum = (s: string) => parseFloat(s);

export default function CityRankTable() {
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [desc, setDesc] = useState(false);
  const [query, setQuery] = useState("");
  const [drawerCity, setDrawerCity] = useState<string | null>(null);

  const sorted = useMemo(() => {
    const arr = CITY_RANK.map((c, i) => ({ ...c, rank: i + 1 }))
      .filter((c) => (query.trim() ? c.name.includes(query.trim()) : true))
      .map((c) => ({ ...c, rank: CITY_RANK.findIndex((x) => x.name === c.name) + 1 }));
    const cmp = (a: any, b: any) => {
      if (sortKey === "rank") return a.rank - b.rank;
      if (sortKey === "gdp") return gdpNum(a.gdp) - gdpNum(b.gdp);
      return a.listed - b.listed;
    };
    arr.sort((a, b) => (desc ? cmp(b, a) : cmp(a, b)));
    return arr;
  }, [sortKey, desc, query]);

  const toggle = (k: SortKey) => {
    if (sortKey === k) setDesc(!desc);
    else {
      setSortKey(k);
      setDesc(k === "rank" ? false : true);
    }
  };

  const head = (k: SortKey, label: string, right = false) => (
    <th className={`py-2 px-3 font-medium whitespace-nowrap ${right ? "text-right" : "text-left"}`}>
      <button
        onClick={() => toggle(k)}
        className={`hover:text-primary transition-colors ${sortKey === k ? "text-primary" : ""}`}
      >
        {label}
        {sortKey === k ? (desc ? " ↓" : " ↑") : ""}
      </button>
    </th>
  );

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索城市（如 深圳 / 苏州 / 成都）"
          className="w-full max-w-xs rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-primary/60"
        />
        <span className="text-xs text-muted ml-auto whitespace-nowrap">匹配 {sorted.length} 城</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted border-b border-border">
              {head("rank", "#")}
              <th className="py-2 px-3 font-medium whitespace-nowrap">城市</th>
              {head("gdp", "GDP", true)}
              {head("listed", "上市公司数", true)}
              <th className="py-2 px-3 font-medium text-left whitespace-nowrap">备注</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((c) => (
              <tr
                key={c.name}
                onClick={() => setDrawerCity(c.name)}
                className="border-b border-border/50 hover:bg-border/20 transition-colors cursor-pointer"
              >
                <td className="py-2 pl-3 pr-3 font-medium w-8">
                  {c.rank <= 3 ? ["🥇", "🥈", "🥉"][c.rank - 1] : c.rank}
                </td>
                <td className="py-2 pr-3 font-medium">{c.name}</td>
                <td className="py-2 px-3 text-right font-mono">{c.gdp}</td>
                <td className="py-2 px-3 text-right font-mono">{c.listed}</td>
                <td className="py-2 px-3 text-xs text-muted">{c.note}</td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-sm text-muted">未找到匹配城市</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <CityDrawer city={drawerCity ? { name: drawerCity } : null} onClose={() => setDrawerCity(null)} />
    </div>
  );
}

export function ProvinceCityPanel() {
  const [province, setProvince] = useState<string | null>(null);
  const region = province ? STATIC_REGIONS.find((r) => r.province === province) : undefined;

  const tagHref = (tag: string) => {
    const id = matchChainId(tag);
    return id ? `/industry?tab=chains&chain=${encodeURIComponent(id)}` : "/industry?tab=chains";
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {STATIC_REGIONS.map((r) => (
          <button
            key={r.province}
            onClick={() => setProvince(r.province)}
            className={`px-2.5 py-1 rounded-md text-xs border transition-colors ${
              province === r.province
                ? "bg-primary text-white border-primary"
                : "border-border hover:border-primary/50"
            }`}
          >
            {r.province}
          </button>
        ))}
      </div>

      {!region && (
        <div className="card p-6 text-center">
          <p className="text-sm text-muted">点击上方省份查看代表城市与支柱产业</p>
        </div>
      )}

      {region && (
        <>
          <div className="card p-4 flex items-center gap-2 flex-wrap">
            <span className="font-bold">{region.province}</span>
            <Badge tone="blue">{region.zone}</Badge>
            <span className="text-sm text-muted">{region.position}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {region.cities.map((c) => (
              <div key={c.name} className="card p-4">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-bold">{c.name}</h3>
                  <span className="text-xs text-muted ml-auto font-mono">{c.gdp}</span>
                </div>
                <div className="space-y-1.5 mt-2">
                  <div className="flex flex-wrap gap-1">
                    {c.pillar.map((t) => (
                      <Link
                        key={`p-${t}`}
                        href={tagHref(t)}
                        className="text-[11px] px-1.5 py-0.5 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                      >
                        {t}
                      </Link>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {c.advantage.map((t) => (
                      <Link
                        key={`a-${t}`}
                        href={tagHref(t)}
                        className="text-[11px] px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-600 dark:text-sky-400 hover:bg-sky-500/20 transition-colors"
                      >
                        {t}
                      </Link>
                    ))}
                  </div>
                </div>
                {c.companies.length > 0 && (
                  <p className="text-[11px] text-muted mt-2">代表企业：{c.companies.join("、")}</p>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}