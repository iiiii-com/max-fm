/**
 * 验证 K 线横轴标签规则：加年份，但最新那年不加。
 * 运行：node scripts/verify-axis-year.mjs
 */
import assert from "node:assert/strict";
import { mkDayLabel, mkDayAxisLabel } from "../lib/data/axis.ts";

// 最新一年（2026）：只显示 MM-DD
{
  const f = mkDayLabel("2026-09-30");
  assert.equal(f("2026-09-30"), "09-30");
  assert.equal(f("2026-01-05"), "01-05");
}

// 更早的年份：带年份
{
  const f = mkDayLabel("2026-09-30");
  assert.equal(f("2025-12-31"), "2025-12-31");
  assert.equal(f("2003-03-15"), "2003-03-15");
  assert.equal(f("2001-08-27"), "2001-08-27");
}

// 跨度只有一年且不是最新年（危机库 1929-1933）：除末年外都带年份
{
  const f = mkDayLabel("1933-07-08");
  assert.equal(f("1929-10-24"), "1929-10-24");
  assert.equal(f("1933-07-08"), "07-08");
}

// 传入 lastDate 与当前值同年 → 不加年份
{
  const f = mkDayLabel("2020-01-02");
  assert.equal(f("2020-01-02"), "01-02");
}

// 缺少 lastDate：无法判定最新年，退化为一律带年份（不静默丢年份）
{
  const f = mkDayLabel(undefined);
  assert.equal(f("2026-09-30"), "2026-09-30");
  assert.equal(f("2019-01-01"), "2019-01-01");
}

console.log("axis-year: 5 组断言全过");

// 首尾标签必须朝网格内侧展开，否则 10 字符标签会压到 Y 轴刻度上
{
  const o = mkDayAxisLabel("2026-09-30", { fontSize: 9 });
  assert.equal(o.alignMinLabel, "left");
  assert.equal(o.alignMaxLabel, "right");
  assert.equal(o.hideOverlap, true);
  assert.equal(o.showMinLabel, true, "首日必须可见，否则 hideOverlap 会把对齐后的首标签吃掉");
  assert.equal(o.showMaxLabel, true);
  assert.equal(o.fontSize, 9);
  assert.equal(o.formatter("1993-11-08"), "1993-11-08");
  assert.equal(o.formatter("2026-07-07"), "07-07");
}

console.log("axis-year: 首尾对齐断言全过");