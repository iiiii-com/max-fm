/**
 * 设计 token 收口（全站一次性改写）
 *
 * 背景：全站存在三类 token 失守，表现为「同一个元素在不同页面/断点长得不一样」：
 *
 *  1. hover 浮起阴影（19 处）。`.card` 本身是 `box-shadow: none`，
 *     规范注释明写"层次主要靠 1px 边框而非浮起感"，
 *     于是只有写了 `hover:shadow-md` 的那批卡片会在悬停时凭空长出 8px 扩散阴影 ——
 *     全站局部风格漂移。→ 删除，只保留 `card-hover` 提供的边框变化。
 *
 *  2. `transition-all`（23 处 vs transition-colors 147 处）。
 *     all 会连带过渡 width/height/opacity，在节点数量变化时引发不必要的重排。
 *     → 改为 transition-colors。
 *
 *  3. `rounded` 未被 token 覆盖（150 处）。Tailwind 默认 4px，
 *     与项目定义的 2px/3px 不在同一条刻度上。
 *     → 在 globals.css 已把 --radius 定义为 2px 兜底（不再逐个改 150 处 class，
 *       那是 150 次无意义 diff；改一处 token 即可全局对齐）。
 *
 * 例外：带 scale / translate / rotate 的元素保留 transition-all，
 * 因为那些属性确实需要过渡，且不涉及布局。
 *
 * 用法：npx tsx scripts/token-codemod.ts [--dry]
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const DRY = process.argv.includes("--dry");
const ROOT = path.resolve(process.cwd());

/** 这些类说明元素有 transform 变化，transition-all 是合理的 */
const NEEDS_TRANSFORM = /(scale-|translate-|rotate-|duration-\d|group-hover:)/;

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    if (e === "node_modules" || e.startsWith(".")) continue;
    const abs = path.join(dir, e);
    if (statSync(abs).isDirectory()) walk(abs, out);
    else if (/\.tsx$/.test(e)) out.push(abs);
  }
  return out;
}

const files = [...walk(path.join(ROOT, "app")), ...walk(path.join(ROOT, "components"))];
let touched = 0;
const report: string[] = [];

for (const abs of files) {
  const rel = path.relative(ROOT, abs);
  const src = readFileSync(abs, "utf8");
  const hits: string[] = [];

  // ---- 1. 删除 hover 浮起阴影 ----
  // 保留 hover:border-* / hover:bg-* / hover:text-*，只摘掉 shadow 变体
  const shadowRe = /\s*hover:shadow-(?:xs|sm|md|lg|xl|2xl)/g;
  if (shadowRe.test(src)) {
    hits.push("删除 hover:shadow-*");
    // 用 replaceAll 语义：正则带 g 需重置 lastIndex
    shadowRe.lastIndex = 0;
  }

  let out = src.replace(/\s*hover:shadow-(?:xs|sm|md|lg|xl|2xl)/g, "");

  // ---- 2. transition-all → transition-colors（除 transform 类）----
  out = out
    .split("\n")
    .map((line) => {
      if (!line.includes("transition-all")) return line;
      if (NEEDS_TRANSFORM.test(line)) return line;
      if (!hits.includes("transition-all → transition-colors")) hits.push("transition-all → transition-colors");
      return line.replace(/\btransition-all\b/g, "transition-colors");
    })
    .join("\n");

  if (out !== src) {
    touched++;
    report.push(`${rel}\n    ${hits.join("\n    ")}`);
    if (!DRY) writeFileSync(abs, out, "utf8");
  }
}

console.log(`${DRY ? "[dry] " : ""}改写 ${touched} 个文件\n`);
console.log(report.join("\n"));
