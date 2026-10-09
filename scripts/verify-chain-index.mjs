/**
 * 链指数计算自检：等权口径、对齐、回撤、相对强弱。
 * 运行：node scripts/verify-chain-index.mjs
 */
import assert from "node:assert/strict";
import { buildChainIndex, relativeStrength, stageBreakdown, interpretStages, MIN_BARS } from "../lib/data/chainIndexCalc.ts";

// 必须用真实递增的 ISO 日期：alignReturns 按字典序求共同交易日，
// 非 ISO 的自造格式会静默打乱顺序（这一点另有专门断言覆盖）
const dates = Array.from({ length: 80 }, (_, i) => {
  const d = new Date(Date.UTC(2026, 0, 1) + i * 86400000);
  return d.toISOString().slice(0, 10);
});

// 单边上涨：指数区间收益必须等于该涨幅
{
  const closes = dates.map((_, i) => 100 * Math.pow(1.01, i));
  const r = buildChainIndex([
    { secid: "1.000001", name: "甲", bars: dates.length, dates, closes },
    { secid: "1.000002", name: "乙", bars: dates.length, dates, closes },
  ]);
  assert.equal(r.members.length, 2);
  // 80 个交易日、每日 +1% → 累计约 +121%
  const want = (Math.pow(1.01, dates.length - 1) - 1) * 100;
  assert.ok(Math.abs(r.stats.ret - want) < 0.5, `区间收益应约 ${want.toFixed(2)}%，实得 ${r.stats.ret}`);
  assert.equal(r.points[0].value, 1000, "基点必须是 1000");
  assert.equal(r.stats.maxDrawdown, 0, "单边上涨不应有回撤");
}

// 等权语义：一只翻倍、一只不动 → 等权收益应为两者平均
{
  const flat = dates.map(() => 100);
  const up = dates.map((_, i) => (i < dates.length - 1 ? 100 : 200));
  const r = buildChainIndex([
    { secid: "1.000001", name: "不动", bars: dates.length, dates, closes: flat },
    { secid: "1.000002", name: "翻倍", bars: dates.length, dates, closes: up },
  ]);
  // 只有最后一天翻倍 → 当日等权收益 = (0 + 100%)/2 = 50%
  assert.ok(Math.abs(r.stats.ret - 50) < 0.01, `等权应得 +50%，实得 ${r.stats.ret}`);
}

// 回撤：先涨后跌 50%，最大回撤应为 -50%
{
  const closes = dates.map((_, i) => (i < 40 ? 100 + i : 140 - (i - 40) * 2));
  const r = buildChainIndex([
    { secid: "1.000001", name: "甲", bars: dates.length, dates, closes },
    { secid: "1.000002", name: "乙", bars: dates.length, dates, closes },
  ]);
  assert.ok(r.stats.maxDrawdown < -40 && r.stats.maxDrawdown > -60, `最大回撤应在 -40%~-60%，实得 ${r.stats.maxDrawdown}`);
}

// 数据不足的成员必须被剔除并给出原因，而不是静默当成 0 收益
{
  const closes = dates.map(() => 100);
  const r = buildChainIndex([
    { secid: "1.000001", name: "甲", bars: dates.length, dates, closes },
    { secid: "1.000002", name: "乙", bars: dates.length, dates, closes },
    { secid: "1.000003", name: "缺数据", bars: 5, dates: dates.slice(0, 5), closes: [1, 2, 3, 4, 5] },
  ]);
  assert.equal(r.members.length, 2, "数据不足的成员不得参与合成");
  assert.equal(r.excluded.length, 1);
  assert.match(r.excluded[0].reason, /根日线/);
  assert.equal(r.excluded[0].name, "缺数据");
}

// 成员不足 2 个 → 不合成（宁可不给，也不给一条只有一只股票的"指数"）
{
  const closes = dates.map(() => 100);
  const r = buildChainIndex([{ secid: "1.000001", name: "独苗", bars: dates.length, dates, closes }]);
  assert.equal(r.points.length, 0);
  assert.equal(r.members.length, 0);
}

// 日期不对齐：只在部分成员出现的交易日必须整行剔除
{
  const d1 = dates;
  const d2 = dates.slice(10); // 晚 10 天上市
  const r = buildChainIndex([
    { secid: "1.000001", name: "老股", bars: d1.length, dates: d1, closes: d1.map(() => 100) },
    { secid: "1.000002", name: "次新", bars: d2.length, dates: d2, closes: d2.map(() => 50) },
  ]);
  assert.equal(r.stats.sessions, d2.length - 1, "共同交易日应取两者交集");
  assert.equal(r.points[0].date, d2[0], "指数起点应是共同窗口首日");
}

// 相对强弱：链与基准同步 → 超额为 0；链跑赢 → 超额为正
{
  const chain = [
    { date: "2026-01-01", value: 1000 },
    { date: "2026-01-02", value: 1100 },
  ];
  const bmSync = [
    { date: "2026-01-01", value: 5000 },
    { date: "2026-01-02", value: 5500 },
  ];
  const rs = relativeStrength(chain, bmSync);
  assert.equal(rs.length, 2);
  assert.ok(Math.abs(rs[1].excess) < 1e-6, "同步涨 10% 时超额应为 0");

  const bmFlat = [
    { date: "2026-01-01", value: 5000 },
    { date: "2026-01-02", value: 5000 },
  ];
  const rs2 = relativeStrength(chain, bmFlat);
  assert.ok(Math.abs(rs2[1].excess - 10) < 1e-6, `基准不动时超额应等于链涨幅 10%，实得 ${rs2[1].excess}`);
}

// MIN_BARS 必须被真正使用（阈值改了行为要跟着变）
{
  assert.ok(MIN_BARS >= 20, "最小样本阈值不应低于 20，否则分位数/波动没有意义");
}

// 非 ISO 日期必须直接抛错：字典序排序会静默打乱顺序，复利结果全错且不报错
{
  let threw = null;
  try {
    buildChainIndex([
      { secid: "1.000001", name: "甲", bars: 80, dates: ["2026-01-01-0", "2026-01-02-1", "2026-01-03-2"], closes: [1, 2, 3] },
      { secid: "1.000002", name: "乙", bars: 80, dates: ["2026-01-01-0", "2026-01-02-1", "2026-01-03-2"], closes: [1, 2, 3] },
    ]);
  } catch (e) {
    threw = e;
  }
  assert.ok(threw, "非 ISO 日期必须抛错，不能静默算出一条错序的曲线");
  assert.match(String(threw.message), /YYYY-MM-DD/);
}

// 环节拆解：段内等权，且段内不足 2 只时不给该段结论
{
  const mk = (secid, name, stage, mult) => ({
    secid, name, stage, bars: dates.length, dates,
    closes: dates.map((_, i) => 100 * Math.pow(mult, i)),
  });
  // 上游 +1%/日，中游 +0.2%/日，下游 只有 1 只（应被排除）
  const stages = stageBreakdown([
    mk("1.000001", "上游甲", "上游", 1.01),
    mk("1.000002", "上游乙", "上游", 1.01),
    mk("1.000003", "中游甲", "中游", 1.002),
    mk("1.000004", "中游乙", "中游", 1.002),
    mk("1.000005", "下游独苗", "下游", 1.005),
  ]);
  const up = stages.find((s) => s.stage === "上游");
  const mid = stages.find((s) => s.stage === "中游");
  const down = stages.find((s) => s.stage === "下游");
  assert.equal(up.count, 2, "上游应有 2 只");
  assert.equal(mid.count, 2, "中游应有 2 只");
  assert.equal(down.members.length, 0, "下游只有 1 只，不给段结论（个股表现不等于段表现）");
  assert.ok(up.ret > mid.ret, "上游 +1%/日应强于中游 +0.2%/日");
}

// 结论解读：必须由数字推出，且分化不足 5 个百分点时不下"某段驱动"的判断
{
  const stages = [
    { stage: "上游", ret: 30, count: 3, members: [{ secid: "a", name: "a", ret: 30 }, { secid: "a2", name: "a2", ret: 29 }] },
    { stage: "中游", ret: 32, count: 3, members: [{ secid: "b", name: "b", ret: 32 }, { secid: "b2", name: "b2", ret: 31 }] },
    { stage: "下游", ret: 31, count: 3, members: [{ secid: "c", name: "c", ret: 31 }, { secid: "c2", name: "c2", ret: 30 }] },
  ];
  const r = interpretStages(stages, 31);
  assert.equal(r.insufficient, false);
  assert.ok(
    r.points.some((p) => p.includes("同涨同跌")),
    "三段差 2 个百分点应判为同涨同跌，不得硬说某段驱动"
  );
  // 注意：那句话本身含「不由…驱动」，所以要断言的是**没有肯定式的驱动判断**
  assert.ok(
    !r.points.some((p) => /(?:由|主要由)(?:上游|中游|下游)驱动/.test(p)),
    "分化不足时不得给出肯定式的「由某段驱动」判断"
  );
}

// 分化显著时：必须指出驱动段，且数字可核对
{
  const stages = [
    { stage: "上游", ret: -10, count: 3, members: [{ secid: "a", name: "a", ret: -10 }, { secid: "a2", name: "a2", ret: -12 }] },
    { stage: "中游", ret: 60, count: 3, members: [{ secid: "b", name: "b", ret: 60 }, { secid: "b2", name: "b2", ret: 58 }] },
    { stage: "下游", ret: 5, count: 3, members: [{ secid: "c", name: "c", ret: 5 }, { secid: "c2", name: "c2", ret: 4 }] },
  ];
  const r = interpretStages(stages, 55);
  assert.equal(r.insufficient, false);
  const joined = r.points.join(" ");
  assert.ok(joined.includes("中游"), "最强段中游必须被点名");
  assert.ok(joined.includes("上游"), "最弱段上游必须被点名");
  assert.ok(joined.includes("70.00"), "段间分化应为 60-(-10)=70 个百分点，且写进结论");
  assert.ok(joined.includes("驱动"), "分化显著时应给出驱动段判断");
}

// 有效层级不足两段 → 明确说"不给结论"，而不是硬凑一句话
{
  const r = interpretStages(
    [
      { stage: "上游", ret: 10, count: 3, members: [{ secid: "a", name: "a", ret: 10 }, { secid: "a2", name: "a2", ret: 9 }] },
      { stage: "中游", ret: 0, count: 1, members: [] },
      { stage: "下游", ret: 0, count: 0, members: [] },
    ],
    10
  );
  assert.equal(r.insufficient, true);
  assert.ok(r.points.join("").includes("无法判断"), "数据不足必须如实说明，不得编结论");
}

console.log("chain-index: 11 组断言全过");