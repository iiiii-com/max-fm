"use client";

import { useEffect, useState } from "react";
import { useRefresh } from "@/lib/hooks/refresh";

interface FundDirection {
  key: string;
  name: string;
  value: number | null;
  trend5: number[];
  source: "realtime" | "aggregated" | "static";
  comment: string;
}

interface DirectionsResp {
  ok: boolean;
  date?: string;
  estimated?: boolean;
  directions?: FundDirection[];
}

function fmtMoney(n: number | null) {
  if (n === null) return "—";
  const a = Math.abs(n);
  if (a >= 1e8) return `${(n / 1e8).toFixed(2)}亿`;
  if (a >= 1e4) return `${(n / 1e4).toFixed(0)}万`;
  return String(n);
}

function Sparkline({ data }: { data: number[] }) {
  if (!data || data.length < 2) return <p className="text-[10px] text-muted">近 5 日暂无</p>;
  const w = 96;
  const h = 30;
  const pad = 3;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (w - pad * 2);
    const y = h - pad - ((v - min) / span) * (h - pad * 2);
    return [x, y] as const;
  });
  const color = data[data.length - 1] >= 0 ? "#dc2626" : "#16a34a";
  const last = pts[pts.length - 1];
  return (
    <svg width={w} height={h} className="block" aria-hidden>
      <polyline
        points={pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ")}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <circle cx={last[0]} cy={last[1]} r={2} fill={color} />
    </svg>
  );
}

const SOURCE_LABEL: Record<string, string> = {
  realtime: "实时",
  aggregated: "聚合估算",
  static: "数据延迟",
};

export default function FundDirections() {
  const [resp, setResp] = useState<DirectionsResp | null>(null);
  const [err, setErr] = useState("");
  const { refreshKey } = useRefresh();

  useEffect(() => {
    let alive = true;
    fetch("/api/funds/directions", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return;
        if (j?.ok) setResp(j);
        else setErr(j?.error ?? "加载失败");
      })
      .catch(() => {
        if (alive) setErr("资金方向数据暂不可用");
      });
    return () => {
      alive = false;
    };
  }, [refreshKey]);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-base">资金方向</h2>
        <span className="text-[10px] text-muted">
          {resp?.date ?? ""}
          {resp?.estimated ? " · 主力/大单/散户为板块聚合估算" : ""}
        </span>
      </div>
      {err && <p className="text-xs text-red-600">{err}</p>}
      {!resp && !err && <p className="text-xs text-muted">资金方向加载中…</p>}
      {resp && (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
          {(resp.directions ?? []).map((d) => (
            <div key={d.key} className="card p-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted">{d.name}</p>
                <span className="text-[9px] px-1 rounded bg-muted/40 text-muted">{SOURCE_LABEL[d.source] ?? ""}</span>
              </div>
              <p className={`text-lg font-bold font-mono mt-1 ${d.value == null ? "text-muted" : d.value >= 0 ? "up" : "down"}`}>
                {d.value == null ? "—" : `${d.value >= 0 ? "+" : ""}${fmtMoney(d.value)}`}
              </p>
              <div className="mt-1.5">
                <Sparkline data={d.trend5} />
              </div>
              <p className="text-[10px] text-muted mt-1.5 leading-snug">{d.comment}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}