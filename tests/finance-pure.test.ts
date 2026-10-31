/**
 * 月份口径 / ETF 净值滞后 / 北向方向映射 的纯函数单测。
 *
 * 这三组都对应过真实事故：
 *  - currentYm 用 UTC 取月 → 每月 1 日 00:00–08:00（CST）月报 slug 错月；
 *  - prevYm 1 月没回退上一年 12 月；
 *  - ETF 溢价率用 T-2 净值（QDII 甚至 T+2）→ 513100 曾显示 +16.7% 的假溢价；
 *  - 北向 shIn/szIn 取错字段（hk2sh/hk2sz 张冠李戴）→ 沪深净流入互相错位。
 */
import test from "node:test";
import assert from "node:assert/strict";

import { currentYm, cstToday, lastDayOfMonth, monthLabel, prevYm } from "../lib/data/ym";
import { navLagDays, mapNorthboundPayload } from "../lib/data/market";

/* ---------- 月份口径 ---------- */

test("currentYm: 使用北京时间，UTC 月末深夜不跨错月", () => {
  // 2026-10-31T16:30Z = 2026-11-01 00:30 CST → 应算 11 月
  assert.equal(currentYm(Date.parse("2026-10-31T16:30:00Z")), "2026-11");
  // 2026-10-31T15:30Z = 2026-10-31 23:30 CST → 仍是 10 月
  assert.equal(currentYm(Date.parse("2026-10-31T15:30:00Z")), "2026-10");
});

test("cstToday: 与 ym 模块同一口径", () => {
  assert.equal(cstToday(Date.parse("2026-10-31T16:30:00Z")), "2026-11-01");
});

test("prevYm: 普通月与 1 月（跨年回退）", () => {
  assert.equal(prevYm("2026-10"), "2026-09");
  assert.equal(prevYm("2026-01"), "2025-12", "1 月的上月是上一年 12 月");
  assert.equal(prevYm("2026-03"), "2026-02");
  assert.equal(prevYm("bad"), "bad", "非法入参原样返回");
});

test("lastDayOfMonth: 大小月与闰年", () => {
  assert.equal(lastDayOfMonth("2026-02"), "2026-02-28");
  assert.equal(lastDayOfMonth("2024-02"), "2024-02-29");
  assert.equal(lastDayOfMonth("2026-04"), "2026-04-30");
  assert.equal(lastDayOfMonth("2026-12"), "2026-12-31");
});

test("monthLabel: 展示文案", () => {
  assert.equal(monthLabel("2026-10"), "2026 年 10 月");
  assert.equal(monthLabel("2026-1"), "2026-1", "格式不合法时不硬造中文");
});

/* ---------- ETF 净值滞后 ---------- */

test("navLagDays: 以 CST 自然日计算滞后天数", () => {
  const now = Date.parse("2026-10-29T10:00:00+08:00");
  assert.equal(navLagDays("2026-10-29", now), 0, "当日净值");
  assert.equal(navLagDays("2026-10-28", now), 1, "T-1");
  assert.equal(navLagDays("2026-10-24", now), 5, "T-5");
  assert.equal(navLagDays("2026-11-01", now), 0, "未来日期按 0 处理（不做负数）");
  assert.equal(navLagDays(null, now), null);
  assert.equal(navLagDays("", now), null);
  assert.equal(navLagDays("not-a-date", now), null);
});

test("navLagDays: 阈值 4 天以内可算溢价、超过才算滞后", () => {
  const now = Date.parse("2026-10-29T10:00:00+08:00");
  const lag = navLagDays("2026-10-26", now);
  assert.ok(lag != null && lag <= 4, "T-3 属正常披露范围，可计算溢价率");
});

/* ---------- 北向方向 ---------- */

test("mapNorthboundPayload: hk2sh=沪股通、hk2sz=深股通（单位万元→元）", () => {
  const d = {
    hk2sh: { dayNetAmtIn: 12345, dayAmtThreshold: 5_200_000, date2: "2026-10-29" },
    hk2sz: { dayNetAmtIn: -678, dayAmtThreshold: 5_200_000, date2: "2026-10-29" },
  };
  const out = mapNorthboundPayload(d);
  assert.equal(out.shIn, 123_450_000, "沪股通 = hk2sh × 1e4");
  assert.equal(out.szIn, -6_780_000, "深股通 = hk2sz × 1e4");
  assert.equal(out.totalIn, 116_670_000);
  assert.equal(out.date, "2026-10-29");
  assert.notEqual(out.stopped, true);
});

test("mapNorthboundPayload: 全 0 视为「停止实时披露」而非「净流入 0」", () => {
  const d = {
    hk2sh: { dayNetAmtIn: 0, dayAmtThreshold: 5_200_000, date2: "2026-10-29" },
    hk2sz: { dayNetAmtIn: 0, dayAmtThreshold: 5_200_000, date2: "2026-10-29" },
  };
  const out = mapNorthboundPayload(d);
  assert.equal(out.stopped, true, "2024-08-16 起停止实时披露");
  assert.equal(out.shIn, 0);
  assert.equal(out.szIn, 0);
});

test("mapNorthboundPayload: 缺字段/空对象不抛错，标记 stopped", () => {
  for (const d of [null, undefined, {}]) {
    const out = mapNorthboundPayload(d as any);
    assert.equal(out.stopped, true);
    assert.equal(out.date, "");
  }
});
