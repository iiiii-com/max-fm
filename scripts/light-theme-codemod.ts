/**
 * 换肤代码改写：把深色主题下的硬编码 hex 批量替换为浅色等价值。
 *
 * 只处理**高置信**映射：
 *  - 涨跌语义色 → 新的 --up / --down
 *  - 分隔线 / 网格 / 次要文字 → 新的浅色等价值
 * 保留不动：渐变色标、彩色底上的反白文字、以及与涨跌无关的分类色
 * （分类色由 lib/charts/theme.ts 的色板统一接管，不在本次机械替换范围内）。
 *
 * 用法：npx tsx scripts/light-theme-codemod.ts [--dry]
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const DRY = process.argv.includes("--dry");
const ROOT = path.resolve(process.cwd());

/** [深色值, 浅色等价值, 原因] */
const MAP: Array<[string, string, string]> = [
  // 涨跌语义（出现最多，且同屏混用三种红是质感最大的破绽）
  ["#d7000b", "#c0392b", "涨=A股红，深底亮红→浅底沉稳红"],
  ["#dc2626", "#c0392b", "涨=red-600 → 浅底涨色"],
  ["#c8102e", "#c0392b", "涨=另一支红 → 统一涨色"],
  ["#ff4d4f", "#c0392b", "涨=亮红 → 浅底沉稳红"],
  ["#16a34a", "#1e8449", "跌=green-600 → 浅底跌色"],
  ["#0aa06e", "#1e8449", "跌=亮绿 → 浅底沉稳绿"],
  ["#00c176", "#1e8449", "跌=终端绿 → 浅底沉稳绿"],
  ["#10b981", "#1e8449", "跌=emerald-500 → 统一跌色"],

  // 分隔线 / 网格：深底上是亮线，浅底上必须变淡，否则满屏灰网格
  ["#292929", "#e2e0dc", "边框=深灰 → 浅底发丝线"],
  ["#cbd5e1", "#e2e0dc", "亮线 → 浅底发丝线"],
  ["#1e293b", "#e2e0dc", "深线 → 浅底发丝线"],

  // 次要文字
  ["#8a8a8a", "#6b6862", "muted 旧值 → 浅底合规 muted"],
  ["#64748b", "#6b6862", "slate-500 → 浅底 muted"],
  ["#6b7280", "#6b6862", "gray-500 → 浅底 muted"],
  ["#94a3b8", "#8a867e", "slate-400 → 浅底次级"],

  // 面 / 条纹
  ["#eef0ec", "#f4f3f0", "surface 旧值 → 浅底 surface"],
  ["#101010", "#f4f3f0", "surface 旧值 → 浅底 surface"],
  ["#141414", "#f4f3f0", "surface 旧值 → 浅底 surface"],

  // 分类色：仅收敛明显过亮/过深的，交给 theme 色板接管
  // 注意：替换值不得同时是另一条规则的键，否则会级联（#3b82f6→#2563eb→#1d4ed8）
  ["#3b82f6", "#1d4ed8", "blue-500 → 蓝-700（白底可读）"],
  ["#2563eb", "#1d4ed8", "blue-600 → 蓝-700（白底可读）"],
  ["#0ea5e9", "#0284c7", "sky-500 → sky-600"],
  ["#f59e0b", "#b45309", "amber-500 → amber-700（白底文字可读）"],
  ["#eab308", "#a16207", "yellow-500 → yellow-700"],
  ["#8b5cf6", "#7c3aed", "violet-500 → violet-600"],
  ["#ec4899", "#be185d", "pink-500 → pink-700"],
  ["#e11d48", "#be123c", "rose-600 → rose-700"],
];

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    if (e === "node_modules" || e.startsWith(".")) continue;
    const abs = path.join(dir, e);
    if (statSync(abs).isDirectory()) walk(abs, out);
    else if (/\.tsx?$/.test(e)) out.push(abs);
  }
  return out;
}

const files = [
  ...walk(path.join(ROOT, "app")),
  ...walk(path.join(ROOT, "components")),
].map((f) => path.relative(ROOT, f));
let touched = 0;
const report: string[] = [];

for (const rel of files) {
  const abs = path.join(ROOT, rel);
  const src = readFileSync(abs, "utf8");
  let out = src;
  const hits: string[] = [];

  for (const [from, to, why] of MAP) {
    // 仅替换小写/大写两种字面量；跳过已经是 var() 的
    const re = new RegExp(from.replace("#", "#"), "gi");
    if (re.test(out)) {
      hits.push(`${from} → ${to} (${why})`);
      out = out.replace(re, to);
    }
  }

  if (out !== src) {
    touched++;
    report.push(`${rel}\n    ${hits.join("\n    ")}`);
    if (!DRY) writeFileSync(abs, out, "utf8");
  }
}

console.log(`${DRY ? "[dry] " : ""}改写 ${touched} 个文件\n`);
console.log(report.join("\n"));
