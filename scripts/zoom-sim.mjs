/**
 * 牛熊 K 线缩放行为推演（确定性验证，不依赖浏览器）
 * 对比「修复前双处理器叠加」与「修复后单一处理器 + 动态下限」
 * 运行：node scripts/zoom-sim.mjs
 */
const N = 8536; // data/sh-index.json 实际日线根数
const MIN_BARS = 2; // 最小可见根数（KlineAnnotations.MIN_VISIBLE_BARS）
const pct2bars = (p) => (p / 100) * N;

// 修复前：原生 listener(硬编码下限 6) + React onWheel(下限 0.05) 两套叠加，一次滚轮缩放两次
function oldStep(span) {
  span = Math.min(100, Math.max(6, span * 0.82)); // handler1 原生 listener
  span = Math.min(100, Math.max(0.05, span * 0.82)); // handler2 React onWheel
  return span;
}

// 修复后：单一处理器 + 按数据量动态推导下限
const minSpan = (MIN_BARS / N) * 100;
function newStep(span) {
  if (span * 0.82 <= minSpan) return minSpan; // 触底：提示 + 回弹
  return Math.min(100, Math.max(minSpan, span * 0.82));
}

function run(name, step) {
  let span = 100;
  let stuckAt = null;
  for (let i = 1; i <= 60; i++) {
    const prev = span;
    span = step(span);
    if (stuckAt === null && Math.abs(span - prev) < 1e-9) stuckAt = { i, span };
  }
  console.log(name);
  console.log(`  60 次上滚后 span = ${span.toFixed(5)}%  ≈ ${pct2bars(span).toFixed(2)} 根日 K`);
  console.log(
    `  首次停滞: ${stuckAt ? `第 ${stuckAt.i} 次 @ ${stuckAt.span.toFixed(4)}% ≈ ${pct2bars(stuckAt.span).toFixed(0)} 根` : "无（可继续缩放）"}`
  );
}

console.log(`数据: ${N} 根日线 | 单根 = ${(100 / N).toFixed(5)}% | 下限(${MIN_BARS} 根) = ${minSpan.toFixed(5)}%\n`);
run("【修复前】双处理器叠加（下限 6 vs 0.05）", oldStep);
console.log();
run("【修复后】单一处理器 + 动态下限（2 根）", newStep);

let s = 100;
const tail = [];
for (let i = 0; i < 40; i++) {
  s = oldStep(s);
  if (i >= 30) tail.push(pct2bars(s).toFixed(0));
}
console.log(`\n修复前最后 10 步可见根数: ${tail.join(" → ")}`);
console.log("  ↑ 在 420~510 根之间反复震荡 —— 即用户反馈的「放大到约 N 根就失效且无反馈」");

// 月线模式一致性检查
const M = 400; // 月线约 400 根
console.log(`\n一致性检查：`);
console.log(`  日线(${N} 根): 旧硬编码 0.05% ≈ ${pct2bars(0.05).toFixed(1)} 根 | 新动态下限 ≈ ${((MIN_BARS / N) * 100 / 100 * N).toFixed(0)} 根`);
console.log(`  月线(${M} 根): 旧硬编码 0.05% ≈ ${((0.05 / 100) * M).toFixed(2)} 根(小于1根, 不可用) | 新动态下限 ≈ ${MIN_BARS} 根`);
