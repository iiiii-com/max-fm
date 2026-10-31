/**
 * 桌面端版本比较单测（node --test，无需 Electron）。
 * 运行：node --test desktop/test-version.test.js
 */
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const { parseVersion, isNewerVersion } = require("./version");

test("parseVersion 容错", () => {
  assert.deepStrictEqual(parseVersion("1.2.3"), [1, 2, 3]);
  assert.deepStrictEqual(parseVersion("v1.2.3"), [1, 2, 3]);
  assert.deepStrictEqual(parseVersion("1.2.0-beta.1"), [1, 2, 0]);
  assert.deepStrictEqual(parseVersion("2"), [2, 0, 0]);
  assert.deepStrictEqual(parseVersion(""), null);
  assert.deepStrictEqual(parseVersion(null), null);
  assert.deepStrictEqual(parseVersion("abc"), null);
});

test("isNewerVersion 主次修补", () => {
  assert.strictEqual(isNewerVersion("1.0.1", "1.0.0"), true);
  assert.strictEqual(isNewerVersion("1.1.0", "1.0.9"), true);
  assert.strictEqual(isNewerVersion("2.0.0", "1.99.99"), true);
  assert.strictEqual(isNewerVersion("1.0.0", "1.0.0"), false);
  assert.strictEqual(isNewerVersion("1.0.0", "1.0.1"), false);
});

test("isNewerVersion 非法输入不误报", () => {
  assert.strictEqual(isNewerVersion("", "1.0.0"), false);
  assert.strictEqual(isNewerVersion("abc", "1.0.0"), false);
  assert.strictEqual(isNewerVersion("1.0.1", ""), false);
  assert.strictEqual(isNewerVersion(null, undefined), false);
});

test("isNewerVersion 预发布按基础版本比较", () => {
  // 1.2.0-beta 与 1.2.0 视为同一版本（不提示"新版本"）
  assert.strictEqual(isNewerVersion("1.2.0-beta", "1.2.0"), false);
  assert.strictEqual(isNewerVersion("1.3.0-rc1", "1.2.0"), true);
});
