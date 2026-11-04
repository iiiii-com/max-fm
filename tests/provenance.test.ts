/**
 * 数据溯源纯函数单测。
 *
 * 这些断言对应「用户看到的状态标签是否可信」——溯源台如果自己判断错，
 * 比没有溯源更糟（会给出「新鲜」的假绿）。所以这一层刻意做成纯函数：
 * 不连库、不读时钟（nowMs 由调用方传入），可以逐条钉死边界。
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  CADENCE,
  statusFromAge,
  statusFromMetric,
  formatAge,
  summarizeProvenance,
  needsAttention,
  STATUS_LABEL,
} from "../lib/data/provenance-logic";

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

test("statusFromAge：null / 负数 / NaN 视为不可用", () => {
  assert.equal(statusFromAge(null, CADENCE.daily), "down");
  assert.equal(statusFromAge(-1, CADENCE.daily), "down");
  assert.equal(statusFromAge(Number.NaN, CADENCE.daily), "down");
});

test("statusFromAge：按 warn / stale 两档切分 live / delayed / stale", () => {
  const daily = CADENCE.daily; // warn 36h / stale 7d
  assert.equal(statusFromAge(1 * HOUR, daily), "live");
  assert.equal(statusFromAge(36 * HOUR, daily), "live", "恰好等于 warn 仍算新鲜");
  assert.equal(statusFromAge(36 * HOUR + 1, daily), "delayed");
  assert.equal(statusFromAge(7 * DAY, daily), "delayed", "恰好等于 stale 仍算延迟");
  assert.equal(statusFromAge(7 * DAY + 1, daily), "stale");
  assert.equal(statusFromAge(400 * DAY, daily), "stale");
});

test("statusFromMetric：空表或没有更新时间都算不可用，不能显示成新鲜", () => {
  assert.equal(statusFromMetric({ rows: 0, lastUpdated: Date.now() }, CADENCE.daily), "down");
  assert.equal(statusFromMetric({ rows: null, lastUpdated: Date.now() }, CADENCE.daily), "down");
  assert.equal(statusFromMetric({ rows: 100, lastUpdated: null }, CADENCE.daily), "down");
  assert.equal(statusFromMetric({ rows: 100, lastUpdated: 0 }, CADENCE.daily), "stale", "0 是 1970 年，判陈旧而不是新鲜");
});

test("statusFromMetric：nowMs 可注入，结果与真实时钟无关", () => {
  const now = Date.UTC(2026, 10, 4, 8, 0, 0);
  const realtime = CADENCE.realtime; // warn 10 分钟 / stale 2 小时
  assert.equal(statusFromMetric({ rows: 10, lastUpdated: now - 2 * MIN }, realtime, now), "live");
  assert.equal(statusFromMetric({ rows: 10, lastUpdated: now - 1 * HOUR }, realtime, now), "delayed");
  assert.equal(statusFromMetric({ rows: 10, lastUpdated: now - 5 * HOUR }, realtime, now), "stale");
});

test("formatAge：人话时间，够用且不会出现 -1 天", () => {
  assert.equal(formatAge(null), "—");
  assert.equal(formatAge(0), "刚刚");
  assert.equal(formatAge(30_000), "刚刚");
  assert.equal(formatAge(5 * MIN), "5 分钟前");
  assert.equal(formatAge(3 * HOUR), "3 小时前");
  assert.equal(formatAge(2 * DAY), "2 天前");
  assert.equal(formatAge(90 * DAY), "3 个月前");
  assert.equal(formatAge(500 * DAY), "1 年前");
});

test("summarizeProvenance：problems 只算陈旧/示例/不可用，stream 不是问题", () => {
  const summary = summarizeProvenance([
    { status: "live" },
    { status: "stream" },
    { status: "delayed" },
    { status: "stale" },
    { status: "seed" },
    { status: "down" },
    { status: "live" },
  ]);
  assert.equal(summary.total, 7);
  assert.equal(summary.live, 2);
  assert.equal(summary.stream, 1);
  assert.equal(summary.delayed, 1);
  assert.equal(summary.stale, 1);
  assert.equal(summary.seed, 1);
  assert.equal(summary.down, 1);
  assert.equal(summary.problems, 3);
});

test("needsAttention：实时接口和正常数据不打扰用户", () => {
  assert.equal(needsAttention("live"), false);
  assert.equal(needsAttention("stream"), false);
  assert.equal(needsAttention("delayed"), false);
  assert.equal(needsAttention("stale"), true);
  assert.equal(needsAttention("seed"), true);
  assert.equal(needsAttention("down"), true);
});

test("状态标签齐全：每个状态都有中文文案", () => {
  const all = ["live", "delayed", "stale", "seed", "down", "stream"] as const;
  for (const status of all) {
    assert.ok(STATUS_LABEL[status] && STATUS_LABEL[status].length > 0, `${status} 缺少标签`);
  }
});
