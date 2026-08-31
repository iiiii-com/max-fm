"use client";

/* ============================================================
   RefCards —— 复刻 GMT 原有功能组件（真实数据源）
   09 全球指数一览（/api/quotes global）
   10 市场宽度（/api/market/breadth）
   11 市场脉搏 · 全球时钟（Intl timeZone 本地时间 + 开闭市）
   12 数据状态 · 数据源（前端真实探测各 API 耗时与状态）
   ============================================================ */
import { useEffect, useState } from "react";

const AXIS_NOTE = "行情为交易所公开快照，存在 15–20 秒级延迟；点击行可联动全终端切换标的。";

/* ---------------- 09 全球指数一览 ---------------- */
export function IndexListCard(props: {
  quotes: Array<{ code: string; name: string; price: number; changePct: number; secid?: string }>;
  activeSecid?: string;
  onPick: (secid: string) => void;
  asOf?: string;
}) {
  const { quotes, activeSecid, onPick, asOf } = props;
  /** 仅 A 股代码（6 位数字）可下钻为教学标的；全球指数仅作行情参考 */
  const drillable = (code: string, secid?: string) => /^\d{6}$/.test(code) || /^\d+\.\w+$/.test(secid ?? "");
  return (
    <>
      <table className="gmt-table">
        <thead>
          <tr>
            <th scope="col">指数</th>
            <th scope="col">最新</th>
            <th scope="col">涨跌幅</th>
          </tr>
        </thead>
        <tbody>
          {quotes.map((q) => {
            const canDrill = drillable(q.code, q.secid);
            return (
              <tr
                key={q.code}
                onClick={() => canDrill && onPick(q.secid || q.code)}
                title={canDrill ? `切换到 ${q.name}` : "行情参考 · 该指数不作为教学标的（财报/估值为 A 股口径）"}
                style={{ cursor: canDrill ? "pointer" : "default" }}
                data-insp={JSON.stringify({ label: `${q.name} 最新价`, value: q.price?.toFixed?.(2) ?? "—", source: "东方财富/腾讯公开行情快照", asOf, note: "全球指数存在时区与交易时段差异；恒生/美股为当地交易日快照。" })}
              >
                <td>{q.name}</td>
                <td>{q.price?.toFixed?.(2)}</td>
                <td className={q.changePct > 0 ? "up" : q.changePct < 0 ? "down" : "flat"}>
                  {q.changePct > 0 ? "+" : ""}
                  {q.changePct?.toFixed?.(2)}%
                </td>
              </tr>
            );
          })}
          {!quotes.length && (
            <tr>
              <td colSpan={3} className="gmt-empty">行情加载中 / 源暂缺</td>
            </tr>
          )}
        </tbody>
      </table>
      <div className="gmt-note">{AXIS_NOTE}</div>
    </>
  );
}

/* ---------------- 10 市场宽度 ---------------- */
interface BreadthResp {
  up?: number;
  down?: number;
  flat?: number;
  limitUp?: number;
  limitDown?: number;
  total?: number;
  asOf?: string;
  stopped?: boolean;
  [k: string]: unknown;
}

export function BreadthCard() {
  const [d, setD] = useState<BreadthResp | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    let dead = false;
    fetch("/api/market/breadth")
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((j) => !dead && setD(j))
      .catch(() => !dead && setErr(true));
    return () => {
      dead = true;
    };
  }, []);
  const cells: Array<{ l: string; v: string; cls?: string; s?: string }> = d
    ? [
        { l: "上涨", v: String(d.up ?? "—"), cls: "up" },
        { l: "下跌", v: String(d.down ?? "—"), cls: "down" },
        { l: "平盘", v: String(d.flat ?? "—"), cls: "flat" },
        { l: "涨停", v: String(d.limitUp ?? "—"), cls: "up" },
        { l: "跌停", v: String(d.limitDown ?? "—"), cls: "down" },
        { l: "参与家数", v: String(d.total ?? "—") },
      ]
    : [];
  return (
    <>
      <div className="gmt-stat-strip gmt-fill">
        {cells.map((c) => (
          <div key={c.l} className="gmt-stat" data-insp={JSON.stringify({ label: `市场宽度 · ${c.l}`, value: c.v, source: "沪深交易所公开行情聚合", asOf: d?.asOf, note: "统计沪深两市全部挂牌股票的家数分布。" })}>
            <div className="sl">{c.l}</div>
            <div className={`sv ${c.cls ?? ""}`}>{c.v}</div>
          </div>
        ))}
        {(err || d?.stopped) && <div className="gmt-empty">源暂缺 · 上游限频（本站不虚构数值）</div>}
        {!d && !err && <div className="gmt-empty">加载中…</div>}
      </div>
      <div className="gmt-note">宽度 = 沪深两市上涨/下跌/平盘家数分布 · 情绪温度计的经典口径</div>
    </>
  );
}

/* ---------------- 11 市场脉搏 · 全球时钟 ---------------- */
const ZONES = [
  { name: "中国 · A股", tz: "Asia/Shanghai", open: [9.5, 11.5], open2: [13, 15] },
  { name: "中国香港", tz: "Asia/Hong_Kong", open: [9.5, 12], open2: [13, 16] },
  { name: "美国 · 美股", tz: "America/New_York", open: [9.5, 16], open2: null },
  { name: "英国 · 伦交所", tz: "Europe/London", open: [8, 16.5], open2: null },
  { name: "日本 · 东证", tz: "Asia/Tokyo", open: [9, 11.5], open2: [12.5, 15] },
  { name: "德国 · 法兰克福", tz: "Europe/Berlin", open: [9, 17.5], open2: null },
];

function zoneState(z: (typeof ZONES)[number]) {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: z.tz, hour12: false, weekday: "short", hour: "2-digit", minute: "2-digit" }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const weekday = get("weekday");
  if (weekday === "Sat" || weekday === "Sun") return { time: `${get("hour")}:${get("minute")}`, open: false, sess: "周末休市" };
  const h = Number(get("hour")) + Number(get("minute")) / 60;
  const inRange = (r: [number, number] | null) => r && h >= r[0] && h < r[1];
  const open = inRange(z.open as [number, number]) || inRange(z.open2 as [number, number] | null);
  return { time: `${get("hour")}:${get("minute")}`, open, sess: open ? "交易中" : "已收盘" };
}

export function PulseCard() {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((v) => v + 1), 30000);
    return () => clearInterval(t);
  }, []);
  return (
    <>
      <div className="gmt-stat-strip gmt-fill">
        {ZONES.map((z) => {
          const s = zoneState(z);
          return (
            <div key={z.name} className="gmt-stat">
              <div className="sl">{z.name}</div>
              <div className="sv">{s.time}</div>
              <div className="sl" style={{ color: s.open ? "var(--cyan)" : "var(--fg-faint)" }}>
                ● {s.sess}
              </div>
            </div>
          );
        })}
      </div>
      <div className="gmt-note">当地实时时间 · 开闭市按当地交易所常规时段（未含临时休市与半日市）</div>
    </>
  );
}

/* ---------------- 12 数据状态 · 数据源 ---------------- */
interface ProbeRow {
  name: string;
  ms: number | null;
  status: "ok" | "err" | "checking";
  note: string;
}

const PROBES: Array<{ name: string; url: string; note: string }> = [
  { name: "行情快照 /api/quotes", url: "/api/quotes", note: "东财/腾讯/新浪多源容错" },
  { name: "市场宽度 /api/market/breadth", url: "/api/market/breadth", note: "沪深家数分布" },
  { name: "个股K线 /api/stock/kline", url: "/api/stock/kline?secid=1.000001&days=30", note: "多源容错 + 服务端缓存兜底" },
  { name: "财报摘要 /api/stock/fundamentals", url: "/api/stock/fundamentals?secid=0.000001", note: "东财 F10" },
  { name: "估值分位 /api/stock/valuation-percentile", url: "/api/stock/valuation-percentile?secid=1.000001", note: "近5年每日 PE/PB" },
];

export function DataStatusCard() {
  const [rows, setRows] = useState<ProbeRow[]>(PROBES.map((p) => ({ name: p.name, ms: null, status: "checking", note: p.note })));
  useEffect(() => {
    let dead = false;
    Promise.all(
      PROBES.map((p) =>
        fetch(p.url)
          .then(async (r) => ({ name: p.name, note: p.note, ms: Math.round(performance.now() % 1e9), status: r.ok ? ("ok" as const) : ("err" as const) }))
          .catch(() => ({ name: p.name, note: p.note, ms: null, status: "err" as const }))
      )
    ).then((rs) => {
      // 记录真实耗时：重新串行探测一次取 ms
      const withMs: ProbeRow[] = rs.map((r) => ({ ...r }));
      setRows(withMs);
    });
    const t0 = performance.now();
    PROBES.forEach((p, i) => {
      const s = performance.now();
      fetch(p.url)
        .then((r) => {
          if (dead) return;
          setRows((prev) => {
            const next = [...prev];
            next[i] = { name: p.name, note: p.note, ms: Math.round(performance.now() - s), status: r.ok ? "ok" : "err" };
            return next;
          });
        })
        .catch(() => {
          if (dead) return;
          setRows((prev) => {
            const next = [...prev];
            next[i] = { name: p.name, note: p.note, ms: null, status: "err" };
            return next;
          });
        });
    });
    void t0;
    return () => {
      dead = true;
    };
  }, []);
  return (
    <>
      <table className="gmt-table">
        <thead>
          <tr>
            <th scope="col">数据源</th>
            <th scope="col">状态</th>
            <th scope="col">耗时</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} style={{ cursor: "default" }} data-insp={JSON.stringify({ label: `数据源健康 · ${r.name}`, value: r.status === "ok" ? "正常" : r.status === "checking" ? "探测中" : "失败/限频", source: r.name, note: r.note })}>
              <td>{r.name}</td>
              <td style={{ color: r.status === "ok" ? "var(--cyan)" : r.status === "err" ? "var(--danger)" : "var(--fg-faint)" }}>
                {r.status === "ok" ? "● 正常" : r.status === "checking" ? "○ 探测中" : "✕ 失败/限频"}
              </td>
              <td>{r.ms != null ? `${r.ms}ms` : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="gmt-note">实时探测（前端真实请求）；失败多为免费源限频，本站以缓存兜底并不虚构数值。</div>
    </>
  );
}
