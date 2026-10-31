/**
 * 版本比较（桌面端「检查更新」用）。
 *
 * 单独成文件的原因：这段逻辑不依赖 Electron，可以直接用 `node --test` 覆盖；
 * 如果写在 main.js 里，任何测试都必须先启动 Electron 主进程，不划算。
 *
 * 规则：按 `major.minor.patch` 数字比较，忽略前导 v 与预发布后缀（1.2.0-beta.1 → 1.2.0），
 * 缺失段按 0 处理；任何解析不了的输入一律视为「不是更新」，避免误弹更新框。
 */
"use strict";

function parseVersion(v) {
  const m = String(v || "")
    .trim()
    .replace(/^v/i, "")
    .match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
  if (!m) return null;
  return [Number(m[1] || 0), Number(m[2] || 0), Number(m[3] || 0)];
}

/** latest 是否比 current 新（严格大于） */
function isNewerVersion(latest, current) {
  const a = parseVersion(latest);
  const b = parseVersion(current);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i += 1) {
    if (a[i] !== b[i]) return a[i] > b[i];
  }
  return false;
}

module.exports = { parseVersion, isNewerVersion };
