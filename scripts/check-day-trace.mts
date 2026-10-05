import assert from "node:assert/strict";
import { computeDayTrace } from "../lib/day-trace.ts";

const NOW = new Date("2026-10-05T15:00:00");

// 未打卡
{
  const r = computeDayTrace({
    clockInAt: null,
    clockOutAt: null,
    loggedHours: 0,
    baseline: [8, 8.5],
    now: NOW,
  });
  assert.equal(r.state, "idle");
  assert.equal(r.onDutyH, 0);
  assert.equal(r.coverage, 0);
  assert.match(r.verdict, /还没打卡/);
}

// 在岗中：09:00 打卡、现在 15:00 = 6h，记了 4h → 漏 2h
{
  const r = computeDayTrace({
    clockInAt: "2026-10-05T09:00:00",
    clockOutAt: null,
    loggedHours: 4,
    baseline: [8, 8],
    now: NOW,
  });
  assert.equal(r.state, "working");
  assert.equal(r.onDutyH, 6);
  assert.equal(r.gapH, 2);
  assert.equal(r.baselineH, 8);
  assert.equal(r.deltaH, -2);
  assert.match(r.verdict, /2\.0h 掉在时间表外/);
  assert.match(r.verdict, /近 2 日平均在岗 8\.0h/);
}

// 已下班，零漏记
{
  const r = computeDayTrace({
    clockInAt: "2026-10-05T09:00:00",
    clockOutAt: "2026-10-05T18:00:00",
    loggedHours: 9,
    baseline: [],
    now: NOW,
  });
  assert.equal(r.state, "closed");
  assert.equal(r.onDutyH, 9);
  assert.equal(r.gapH, 0);
  assert.equal(r.baselineH, null);
  assert.equal(r.coverage, 1);
  assert.match(r.verdict, /全部记录/);
  assert.doesNotMatch(r.verdict, /平均在岗/); // 无历史时不该编出基线
}

// 边界：打卡时间晚于下班（数据被改坏）→ 不出负数
{
  const r = computeDayTrace({
    clockInAt: "2026-10-05T18:00:00",
    clockOutAt: "2026-10-05T09:00:00",
    loggedHours: 0,
    baseline: [Number.NaN, 0, -3, 7],
    now: NOW,
  });
  assert.equal(r.onDutyH, 0);
  assert.equal(r.gapH, 0);
  assert.equal(r.baselineH, 7); // NaN/0/负数都被剔除，只剩 7
}

// 边界：已下班但一整天没记
{
  const r = computeDayTrace({
    clockInAt: "2026-10-05T09:00:00",
    clockOutAt: "2026-10-05T20:00:00",
    loggedHours: 0,
    baseline: [],
    now: NOW,
  });
  assert.equal(r.onDutyH, 11);
  assert.match(r.verdict, /一笔都没记/);
}

// 边界：记的工时超过在岗时长 → 覆盖率封顶，不出现负缺口
{
  const r = computeDayTrace({
    clockInAt: "2026-10-05T09:00:00",
    clockOutAt: "2026-10-05T12:00:00",
    loggedHours: 99,
    baseline: [],
    now: NOW,
  });
  assert.equal(r.onDutyH, 3);
  assert.equal(r.gapH, 0);
  assert.equal(r.coverage, 1);
}

console.log("day-trace: 7 组断言全过");
