/**
 * 数值归一化单测。
 *
 * 背景（真实事故）：东财接口对缺失数值返回字符串 "-"（不是 null），
 * 旧代码直接 v.toFixed(2) → TypeError: v.toFixed is not a function，
 * /market 页整块资金流面板被 React 卸载（pageerror）。toNum 是统一防线，
 * 必须保证「缺失 → null（渲染 —）」，而不是 0 或 NaN。
 */
import test from "node:test";
import assert from "node:assert/strict";

import { toNum } from "../lib/utils";

test("toNum: 缺失值一律返回 null（不是 0/NaN）", () => {
  for (const v of [null, undefined, "", "-", "--", "—", "abc", NaN, Infinity, -Infinity, {}, []]) {
    assert.equal(toNum(v), null, `value=${JSON.stringify(v)} 应为 null`);
  }
});

test("toNum: 正常数值与数字字符串原样返回", () => {
  assert.equal(toNum(0), 0, "0 是有效数值，不能被当成缺失");
  assert.equal(toNum(12.34), 12.34);
  assert.equal(toNum(-5), -5);
  assert.equal(toNum("12.34"), 12.34);
  assert.equal(toNum("-0.5"), -0.5);
  assert.equal(toNum(" 42 "), 42, "带空格的数字字符串也应能解析");
});

test("toNum: 极端但有限的数值保留（不做静默裁剪）", () => {
  assert.equal(toNum(1e15), 1e15);
  assert.equal(toNum(-1e15), -1e15);
  assert.equal(toNum(Number.MAX_SAFE_INTEGER), Number.MAX_SAFE_INTEGER);
});
