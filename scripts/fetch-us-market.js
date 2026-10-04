/**
 * 抓取美股长历史日线（标普500 / 纳斯达克100），写入 data/us-market.json。
 *
 * 为什么要做：data/us-market.json 此前只有 21 根年度 K 线（2005-2025），
 * 且大量 OHLC 为 null，只能看"每年一个点"，无法做形态识别与日线级分析。
 * 改为日线级长历史后，美股 K 线才能与 A 股口径一致地做周期对比。
 *
 * 数据源：腾讯财经 usfqkline（与站内 A 股 sh-index 同源，口径一致）
 * 口径：日期/开/收/高/低/量，与 data/sh-index.json 对齐
 *
 * 接口限制：单次最多返回 320 根，且返回区间内"最后 N 根"，
 * 因此按自然年分页抓取（一年约 250 个交易日 < 320，安全）。
 */
const fs = require("node:fs");

const TARGETS = [
  { key: "spx", code: "usINX", name: "标普 500" },
  { key: "ndx", code: "usNDX", name: "纳斯达克 100" },
];

const OUT = "data/us-market.json";
const START_YEAR = 2005;
const END_YEAR = 2026;

async function fetchRange(code, from, to) {
  const url = `https://web.ifzq.gtimg.cn/appstock/app/usfqkline/get?param=${code},day,${from},${to},320,qfq`;
  const c = new AbortController();
  const timer = setTimeout(() => c.abort(), 40000);
  try {
    const r = await fetch(url, {
      signal: c.signal,
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = await r.json();
    const node = j?.data?.[code] || {};
    return node.qfqday || node.day || [];
  } finally {
    clearTimeout(timer);
  }
}

/** 腾讯行：[date, open, close, high, low, volume, ...] —— 注意 high 在 close 之后 */
function toBar(row) {
  const [date, open, close, high, low, volume] = row;
  const n = (v) => (v == null || v === "" ? null : Number(v));
  return {
    date,
    open: n(open),
    close: n(close),
    high: n(high),
    low: n(low),
    volume: n(volume) == null ? null : Math.round(Number(volume)),
  };
}

const round2 = (v) => (v == null || !isFinite(v) ? null : Math.round(v * 100) / 100);

(async () => {
  const out = {};

  for (const t of TARGETS) {
    const map = new Map();
    let fetched = 0;

    for (let y = START_YEAR; y <= END_YEAR; y++) {
      const from = `${y}-01-01`;
      const to = y === END_YEAR ? `${END_YEAR}-12-31` : `${y}-12-31`;
      try {
        const seg = await fetchRange(t.code, from, to);
        for (const row of seg) {
          const b = toBar(row);
          if (b.date && b.close != null) map.set(b.date, b);
        }
        fetched += seg.length;
      } catch (e) {
        console.log(`  ${t.key} ${y} 失败: ${e.message}`);
      }
      await new Promise((r) => setTimeout(r, 350));
    }

    const bars = [...map.values()].sort((a, b) => (a.date < b.date ? -1 : 1));

    // 年度聚合（保留以兼容既有年度视图消费方）
    const byYear = new Map();
    for (const b of bars) {
      const y = Number(b.date.slice(0, 4));
      const cur = byYear.get(y);
      if (!cur) {
        byYear.set(y, { year: y, open: b.open, close: b.close, high: b.high, low: b.low });
      } else {
        cur.close = b.close;
        cur.high = Math.max(cur.high ?? -Infinity, b.high ?? -Infinity);
        cur.low = Math.min(cur.low ?? Infinity, b.low ?? Infinity);
      }
    }
    const annual = [...byYear.values()]
      .sort((a, b) => a.year - b.year)
      .map((y) => ({
        year: y.year,
        open: round2(y.open),
        close: round2(y.close),
        high: round2(y.high),
        low: round2(y.low),
      }));

    out[t.key] = { name: t.name, code: t.code, daily: bars, annual };

    const span =
      ((new Date(bars[bars.length - 1].date) - new Date(bars[0].date)) / 86400000 / 365.25).toFixed(1);
    console.log(
      `✓ ${t.key} (${t.name}) 日线 ${bars.length} 根 | ${bars[0].date} ~ ${bars[bars.length - 1].date} | ${span} 年 | 年度 ${annual.length} 条 | 拉取 ${fetched} 条去重后 ${bars.length}`
    );
  }

  out.meta = {
    source: "腾讯财经 usfqkline 日线（复权 qfq），按自然年分页抓取",
    fetchedAt: new Date().toISOString(),
    note: "daily 为日线级（日期/开/收/高/低/量），口径与 data/sh-index.json 一致；annual 由 daily 聚合，保留以兼容年度视图。",
  };

  fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
  console.log(`\n已写入 ${OUT} (${(fs.statSync(OUT).size / 1024).toFixed(1)} KB)`);
})();