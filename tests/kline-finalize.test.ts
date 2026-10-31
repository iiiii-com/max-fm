/**
 * 周/月 K「对齐最新交易日 + 叠加当日实时 bar」单测。
 *
 * 这些断言对应过去真实出现过的用户可见 bug：
 *  1) 东财周 K 的 date 是周一、月 K 是月初首个交易日 → 图例显示「最新 10-19」「最新 10-08」，
 *     用户以为 K 线两周没更新；
 *  2) 盘中最后一根不叠加实时快照 → 当日价格永远缺一格；
 *  3) 周/月量能被当日快照覆盖 → 月 K 最后一根看起来缩量 20 倍。
 * 纯计算已抽到 lib/data/kline-finalize.ts（不碰网络/数据库）。
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  finalizeBars,
  weekEndLabel,
  monthEndLabel,
  cstToday,
  type SnapshotQuote,
} from "../lib/data/kline-finalize";
import type { KlineBar } from "../lib/data/kline-types";

const bar = (date: string, o: number, c: number, h: number, l: number, v: number, a = v * 100): KlineBar => ({
  date,
  open: o,
  close: c,
  high: h,
  low: l,
  volume: v,
  amount: a,
});

test("weekEndLabel: 周内任意一天都归一到当周周五", () => {
  assert.equal(weekEndLabel("2026-10-19"), "2026-10-23", "周一 → 周五");
  assert.equal(weekEndLabel("2026-10-21"), "2026-10-23", "周三 → 周五");
  assert.equal(weekEndLabel("2026-10-23"), "2026-10-23", "周五保持");
  assert.equal(weekEndLabel("2026-10-24"), "2026-10-23", "周六归到本周五（不是下周五）");
  assert.equal(weekEndLabel("bad-date"), "bad-date", "非法日期原样返回，不抛错");
});

test("monthEndLabel: 归一到自然月最后一天（含闰年 2 月）", () => {
  assert.equal(monthEndLabel("2026-10-08"), "2026-10-31");
  assert.equal(monthEndLabel("2026-02-03"), "2026-02-28");
  assert.equal(monthEndLabel("2024-02-01"), "2024-02-29", "闰年 2 月 29 天");
  assert.equal(monthEndLabel("2026-12-01"), "2026-12-31");
  assert.equal(monthEndLabel("bad"), "bad");
});

test("日 K: 实时快照比最后一根更新时补一根（盘中当日 bar）", () => {
  const klines = [bar("2026-10-22", 100, 101, 102, 99, 1000), bar("2026-10-23", 101, 102, 103, 100, 1200)];
  const quote: SnapshotQuote = {
    price: 105.5,
    open: 102,
    high: 106,
    low: 101,
    volume: 800,
    amount: 84_000_00,
    tradeDate: "2026-10-26",
  };
  const out = finalizeBars("day", klines, quote, "2026-10-26");
  assert.equal(out.bars.length, 3);
  assert.deepEqual(out.bars[2], {
    date: "2026-10-26",
    open: 102,
    close: 105.5,
    high: 106,
    low: 101,
    volume: 800,
    amount: 84_000_00,
  });
  assert.equal(out.live, true, "快照交易日期=今天 且 末根即该日 → live");
  assert.equal(out.tradeDate, "2026-10-26");
});

test("日 K: 快照与最后一根同一天时合并（high/low 取更宽，不应回退）", () => {
  const klines = [bar("2026-10-23", 100, 101, 104, 98, 1000)];
  const quote: SnapshotQuote = { price: 102.5, high: 103, low: 99, volume: 1500, tradeDate: "2026-10-23" };
  const out = finalizeBars("day", klines, quote, "2026-10-23");
  assert.equal(out.bars.length, 1, "同一天不新增 bar");
  assert.equal(out.bars[0].close, 102.5);
  assert.equal(out.bars[0].high, 104, "保留盘中已出现的更高价");
  assert.equal(out.bars[0].low, 98, "保留盘中已出现的更低价");
  assert.equal(out.bars[0].volume, 1500);
  assert.equal(out.live, true);
});

test("日 K: 周末快照（tradeDate=上周五）不应把 live 置真", () => {
  const klines = [bar("2026-10-23", 100, 101, 102, 99, 1000)];
  const quote: SnapshotQuote = { price: 101.5, tradeDate: "2026-10-23" };
  const out = finalizeBars("day", klines, { ...quote, price: 101.5 }, "2026-10-25"); // 周日
  assert.equal(out.live, false, "今天没有成交，live 必须为 false");
});

test("周 K: 日期改为周期末，末根日期收敛到实时交易日", () => {
  // 东财周 K：date 是周一
  const weeks = [
    bar("2026-10-12", 100, 103, 105, 99, 5000),
    bar("2026-10-19", 103, 104, 106, 101, 6000),
  ];
  const quote: SnapshotQuote = { price: 107, high: 108, low: 100, volume: 900, tradeDate: "2026-10-21" };
  const out = finalizeBars("week", weeks, quote, "2026-10-21");
  assert.equal(out.bars[0].date, "2026-10-16", "第一周 → 周五 10-16");
  assert.equal(out.bars[1].date, "2026-10-21", "当前周未走完 → 收敛到实时交易日，不能提前标成 10-23");
  assert.equal(out.bars[1].close, 107, "叠加盘中实时价");
  assert.equal(out.bars[1].high, 108);
  assert.equal(out.bars[1].low, 100, "实时 low 更宽时取更宽");
});

test("周 K: 量能是周期累计，不能被当日快照覆盖（历史 bug：缩小 20 倍）", () => {
  const weeks = [bar("2026-10-12", 100, 103, 105, 99, 5000), bar("2026-10-19", 103, 104, 106, 101, 6000)];
  // archive 已含本周累计 6000（东财口径），当日快照只有 900
  const quote: SnapshotQuote = { price: 104, volume: 900, amount: 90_000, tradeDate: "2026-10-21" };
  const out = finalizeBars("week", weeks, quote, "2026-10-21");
  assert.equal(out.bars[1].volume, 6000, "保留周期累计量能，不能被 900 覆盖");
  // 另一种来源：新浪日线聚合只到上一交易日，当日量 900 尚未计入 → 取两者较大值补上
  const weeksSina = [bar("2026-10-12", 100, 103, 105, 99, 5000), bar("2026-10-19", 103, 104, 106, 101, 200)];
  const out2 = finalizeBars("week", weeksSina, quote, "2026-10-21");
  assert.equal(out2.bars[1].volume, 900, "缺当日量时用快照量兜底");
});

test("月 K: date 从月初归一到月末；当前月收敛到实时交易日", () => {
  const months = [bar("2026-09-01", 100, 105, 108, 98, 50000), bar("2026-10-08", 105, 107, 110, 104, 30000)];
  const quote: SnapshotQuote = { price: 109, high: 111, low: 103, volume: 4000, tradeDate: "2026-10-29" };
  const out = finalizeBars("month", months, quote, "2026-10-29");
  assert.equal(out.bars[0].date, "2026-09-30");
  assert.equal(out.bars[1].date, "2026-10-29", "当前月未结束 → 显示实时交易日");
  assert.equal(out.bars[1].close, 109);
  assert.equal(out.bars[1].volume, 30000, "月 K 累计量能不被当日量覆盖");
});

test("周/月 K: 无实时快照时也能正常归一（不抛错）", () => {
  const weeks = [bar("2026-10-12", 100, 103, 105, 99, 5000)];
  const out = finalizeBars("week", weeks, null, "2026-10-25");
  assert.equal(out.bars[0].date, "2026-10-16");
  assert.equal(out.live, false);
});

test("cstToday: 用 +8h 计算，UTC 服务器上 00:30 CST 不算成昨天", () => {
  // 2026-10-28T16:30Z = 2026-10-29 00:30 CST
  assert.equal(cstToday(Date.parse("2026-10-28T16:30:00Z")), "2026-10-29");
  // 2026-10-28T15:30Z = 2026-10-28 23:30 CST
  assert.equal(cstToday(Date.parse("2026-10-28T15:30:00Z")), "2026-10-28");
});
