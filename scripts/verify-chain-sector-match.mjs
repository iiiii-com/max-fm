/**
 * 产业链 → 板块 code 的匹配规则自检。
 *
 * 这段逻辑的风险是"看起来匹配上了、其实是另一个板块"：
 * code 写错会把**别人的资金流**当成这条链的表现 —— 精确、量级合理、完全错误，
 * 比留空危险得多。所以每条规则都要有断言锁住。
 * 运行：node scripts/verify-chain-sector-match.mjs
 */
import assert from "node:assert/strict";
import { matchChainsToBoards, normalizeChainName, APPROVED } from "../lib/data/chain-sector-sync.ts";

const B = (code, name, kind = 2) => ({ code, name, kind });

// 名称规范化：去掉通用后缀才能比对
{
  assert.equal(normalizeChainName("新能源汽车产业链"), "新能源汽车");
  assert.equal(normalizeChainName("光伏产业"), "光伏");
  assert.equal(normalizeChainName("半导体行业"), "半导体");
  assert.equal(normalizeChainName("医药生物"), "医药生物");
}

// 精确同名 → 写入
{
  const r = matchChainsToBoards(
    [{ slug: "semiconductor", name: "半导体产业链" }],
    [B("BK1036", "半导体")]
  );
  assert.equal(r.matched.length, 1);
  assert.equal(r.matched[0].code, "BK1036");
}

// 板块名包含链关键词（正向）→ 写入
{
  const r = matchChainsToBoards(
    [{ slug: "solar", name: "光伏产业" }],
    [B("BK1031", "光伏设备")]
  );
  assert.equal(r.matched.length, 1, "「光伏设备」应匹配「光伏」");
  assert.equal(r.matched[0].code, "BK1031");
}

// 多候选取最短名（确定性规则，不是猜）
{
  const r = matchChainsToBoards(
    [{ slug: "solar", name: "光伏产业" }],
    [
      B("BK1031", "光伏设备", 2),
      B("BK1246", "光伏电池组件", 3),
      B("BK1247", "光伏辅材", 3),
      B("BK1248", "光伏加工设备", 3),
    ]
  );
  assert.equal(r.matched.length, 1, "多候选应自动选一个，而不是留空");
  assert.equal(r.matched[0].code, "BK1031", "应选行业板块「光伏设备」");
  assert.equal(r.picked.length, 1, "选择必须留痕");
  assert.match(r.picked[0], /其余候选/, "留痕里要列出落选的候选，便于复核");
}

// 同长度多候选 → 不写，进人工确认（真正无法区分时不猜）
{
  const r = matchChainsToBoards(
    [{ slug: "x", name: "风电产业" }],
    [B("BK1", "风电甲", 2), B("BK2", "风电乙", 2)]
  );
  assert.equal(r.matched.length, 0, "同类型同长度多候选不得自动写入");
  assert.equal(r.ambiguous.length, 1);
}

// 反向匹配（链名包含板名）→ 只报告不写入
{
  const r = matchChainsToBoards(
    [{ slug: "gpu-cloud", name: "算力租赁产业" }],
    [B("BK1365", "租赁")]
  );
  assert.equal(r.matched.length, 0, "反向匹配必须不写入 —— 租赁行业与算力租赁无关");
  assert.equal(r.review.length, 1);
  assert.match(r.review[0], /租赁/);
}

// 人工确认表优先于一切自动规则
{
  assert.equal(APPROVED["nev"], "BK1211");
  const r = matchChainsToBoards(
    [{ slug: "nev", name: "新能源汽车产业链" }],
    [B("BK1211", "汽车"), B("BK9999", "新能源汽车")]
  );
  assert.equal(r.matched.length, 1);
  assert.equal(r.matched[0].code, "BK1211", "人工确认应优先于精确同名");
  assert.match(r.matched[0].board, /人工确认/);
}

// 人工映射指向的板块不存在 → 进复核队列，不得静默跳过
{
  const r = matchChainsToBoards(
    [{ slug: "nev", name: "新能源汽车产业链" }],
    [B("BK0000", "无关板块")]
  );
  assert.equal(r.matched.length, 0);
  assert.equal(r.review.length, 1);
  assert.match(r.review[0], /已不存在/);
}

// 无匹配 → 保持为空（页面对空 code 的行为是不展示板块入口）
{
  const r = matchChainsToBoards(
    [{ slug: "ai", name: "人工智能产业" }],
    [B("BK0475", "银行")]
  );
  assert.equal(r.matched.length, 0);
  assert.equal(r.unmatched.length, 1);
}

// 概念板块同样参与匹配（只取行业板块会漏掉人工智能/白酒/储能这类链）
{
  const r = matchChainsToBoards(
    [{ slug: "ai", name: "人工智能产业" }],
    [B("BK0800", "人工智能", 3)]
  );
  assert.equal(r.matched.length, 1, "概念板块（t:3）必须参与匹配");
  assert.equal(r.matched[0].code, "BK0800");
}

// 空板块列表 → 全部进无匹配，绝不写入
{
  const r = matchChainsToBoards([{ slug: "a", name: "任意产业链" }], []);
  assert.equal(r.matched.length, 0);
  assert.equal(r.unmatched.length, 1);
}


// 同长度时行业板块优先于概念板块（实测补上的规则：光伏设备 vs 光伏辅材同为 4 字）
{
  const r = matchChainsToBoards(
    [{ slug: "solar", name: "光伏产业" }],
    [B("BK1247", "光伏辅材", 3), B("BK1031", "光伏设备", 2)]
  );
  assert.equal(r.matched.length, 1, "同长度时应能靠行业/概念区分开");
  assert.equal(r.matched[0].code, "BK1031", "行业板块优先");
}

console.log("chain-sector-match: 12 组断言全过");