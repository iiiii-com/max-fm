/**
 * 审计站内每个 K 线图的**实际**时间跨度。
 * 目的：找出"时间跨度只有一年"的图，以及只覆盖近几年的图。
 * 手法：静态扫描各组件的数据来源与截取条件，再用构建产物核对页面上的实际区间文案。
 */
const fs = require("node:fs");
const path = require("node:path");

const ROOTS = ["components", "app"];
const out = [];

function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === ".next") continue;
      walk(p);
    } else if (/\.tsx?$/.test(e.name)) {
      out.push(p);
    }
  }
}
ROOTS.forEach(walk);

const DATA_FILES = {
  "sh-index": "data/sh-index.json",
  "us-market": "data/us-market.json",
  "shanghai-sample": "data/shanghai-sample.json",
};

// 1) 先算每个数据文件的真实跨度
function span(file) {
  if (!fs.existsSync(file)) return null;
  const d = JSON.parse(fs.readFileSync(file, "utf8"));
  const pick = (arr) => {
    if (!arr?.length) return null;
    const first = arr[0].date ?? arr[0][0];
    const last = arr[arr.length - 1].date ?? arr[arr.length - 1][0];
    return { n: arr.length, first, last };
  };
  if (Array.isArray(d)) return pick(d);
  const res = {};
  for (const k of Object.keys(d)) {
    if (Array.isArray(d[k])) res[k] = pick(d[k]);
    else if (d[k] && Array.isArray(d[k].daily)) res[k] = pick(d[k].daily);
  }
  return res;
}

console.log("=== 数据文件真实跨度 ===");
for (const [k, f] of Object.entries(DATA_FILES)) {
  const s = span(f);
  if (!s) { console.log(`  ${k}: 文件不存在`); continue; }
  if (Array.isArray(s)) {
    const yrs = ((new Date(s.last) - new Date(s.first)) / 86400000 / 365.25).toFixed(1);
    console.log(`  ${k}: ${s.n} 根 | ${s.first} ~ ${s.last} | ${yrs} 年`);
  } else {
    for (const [ik, v] of Object.entries(s)) {
      if (!v) { console.log(`  ${k}.${ik}: 无序列`); continue; }
      const yrs = ((new Date(v.last) - new Date(v.first)) / 86400000 / 365.25).toFixed(1);
      console.log(`  ${k}.${ik}: ${v.n} 根 | ${v.first} ~ ${v.last} | ${yrs} 年`);
    }
  }
}

console.log("\n=== 组件里的时间窗口截取（找短窗口）===");
const YEAR_RE = /(20\d{2})-\d{2}-\d{2}/g;
const findings = [];
for (const f of out) {
  const t = fs.readFileSync(f, "utf8");
  if (!/kline|candlestick|Kline/i.test(t)) continue;
  const lines = t.split("\n");
  lines.forEach((ln, i) => {
    // 硬编码起始日期，或 slice(-N) 之类的小窗口
    const hard = ln.match(/>=\s*"(20\d{2}-\d{2}-\d{2})"/) || ln.match(/>\s*"(20\d{2}-\d{2}-\d{2})"/);
    const sliceN = ln.match(/slice\(\s*-\s*(\d{1,4})\s*\)/);
    const lastN = ln.match(/last\s*(\d{1,4})\b/);
    const filterDate = ln.match(/filter\([^)]*(date|d)[^)]*(>=|>)\s*"(20\d{2}-\d{2}-\d{2})"/);
    if (hard || filterDate) {
      findings.push({ file: f, line: i + 1, code: ln.trim().slice(0, 110), kind: "硬编码起始日" });
    } else if (sliceN && Number(sliceN[1]) <= 400) {
      findings.push({ file: f, line: i + 1, code: ln.trim().slice(0, 110), kind: `slice(-${sliceN[1]})` });
    } else if (lastN && Number(lastN[1]) <= 400) {
      findings.push({ file: f, line: i + 1, code: ln.trim().slice(0, 110), kind: `last ${lastN[1]}` });
    }
  });
}

for (const x of findings) {
  console.log(`  [${x.kind}] ${x.file}:${x.line}`);
  console.log(`      ${x.code}`);
}

// 3) 组件引用的数据源
console.log("\n=== K线组件的数据来源 ===");
for (const f of out) {
  const t = fs.readFileSync(f, "utf8");
  if (!/candlestick/.test(t)) continue;
  const imports = [...t.matchAll(/from\s+"@\/data\/([^"]+)"|from\s+"@\/lib\/data\/([^"]+)"/g)].map(
    (m) => m[1] || m[2]
  );
  const apiCalls = [...t.matchAll(/fetch\(\s*[`"'](\/api\/[^`"']+)/g)].map((m) => m[1]);
  const uniq = [...new Set(imports)];
  if (uniq.length || apiCalls.length) {
    console.log(`  ${f}`);
    if (uniq.length) console.log(`      data: ${uniq.join(", ")}`);
    if (apiCalls.length) console.log(`      api : ${[...new Set(apiCalls)].join(", ")}`);
  }
}