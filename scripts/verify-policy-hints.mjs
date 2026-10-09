/**
 * 政策 ↔ 产业链关键词关联自检。
 *
 * 这段逻辑的风险是"双向不一致"：政策页与链页若各用一份关键词表，
 * 迟早出现"政策页说涉及半导体、链页说没有"。所以断言里同时验证两个方向，
 * 并强制两处共用同一份数据。
 * 运行：node scripts/verify-policy-hints.mjs
 */
import assert from "node:assert/strict";
import { SECTOR_HINTS, HINT_BY_SLUG, chainsHitBy, policyHitsChain, hitWords } from "../lib/data/chainPolicyHints.ts";

// 每个 slug 必须唯一，且与 HINT_BY_SLUG 一一对应
{
  const slugs = SECTOR_HINTS.map((h) => h.slug);
  assert.equal(new Set(slugs).size, slugs.length, "slug 不得重复");
  for (const h of SECTOR_HINTS) {
    assert.equal(HINT_BY_SLUG[h.slug], h, `${h.slug} 的索引必须指向同一条记录`);
    assert.ok(h.words.length >= 2, `${h.slug} 至少要有 2 个特征词，单词极易误命中`);
    assert.ok(h.label && h.slug, `${h.slug} 缺 label`);
  }
}

// 禁用泛词：这些词在任何政策里都常见，命中它们等于没命中
{
  const BANNED = ["银行", "消费", "投资", "经济", "发展", "企业", "市场", "产业", "行业", "建设", "政策"];
  for (const h of SECTOR_HINTS) {
    for (const w of h.words) {
      assert.ok(
        !BANNED.includes(w),
        `「${h.slug}」用了泛词「${w}」—— 旧表正是因泛词把《审计法实施条例》标成"受益：银行保险、消费"`
      );
    }
  }
}

// 正向：命中判定
{
  const corpus = "国务院关于印发推动大规模设备更新和消费品以旧换新行动方案的通知";
  const hits = chainsHitBy(corpus);
  assert.ok(hits.some((h) => h.slug === "baijiu"), "含「以旧换新」应命中消费");
  assert.ok(!hits.some((h) => h.slug === "solar"), "未提光伏不应命中光伏");
}

// 反向：两个方向必须一致（同一 corpus、同一 slug）
{
  const corpora = [
    "关于加快集成电路与半导体产业发展的若干政策",
    "新能源汽车动力电池回收利用管理办法",
    "关于开展人形机器人产业创新发展的指导意见",
    "关于加强粮食安全保障与种业振兴的意见",
  ];
  for (const corpus of corpora) {
    for (const h of SECTOR_HINTS) {
      const forward = chainsHitBy(corpus).some((x) => x.slug === h.slug);
      const backward = policyHitsChain(corpus, h.slug);
      assert.equal(forward, backward, `${h.slug} 正反向判定不一致（${corpus.slice(0, 12)}…）`);
    }
  }
}

// 命中词必须可复现：hitWords 返回的词必须真的出现在 corpus 里，且是命中原因
{
  const corpus = "推动新能源汽车与充电桩建设，同时支持光伏与风电装机";
  const w = hitWords(corpus, "nev");
  assert.ok(w.length > 0, "应命中新能源汽车");
  for (const x of w) assert.ok(corpus.includes(x), `返回的命中词「${x}」必须真的在原文里`);
  // 返回的词集合应等于该链特征词与 corpus 的交集
  const expect = HINT_BY_SLUG["nev"].words.filter((x) => corpus.includes(x));
  assert.deepEqual([...w].sort(), [...expect].sort());
}

// 未知 slug 不得抛错，也不得误判为命中
{
  assert.equal(policyHitsChain("任何文本", "not-a-chain"), false);
  assert.deepEqual(hitWords("任何文本", "not-a-chain"), []);
}

// 每个 slug 都必须能对应到站内真实存在的产业链（否则命中后跳转 404）
{
  const fs = await import("node:fs");
  const chainsSrc = fs.readFileSync(new URL("../lib/data/chains.ts", import.meta.url), "utf8");
  for (const h of SECTOR_HINTS) {
    assert.ok(
      chainsSrc.includes(`id: "${h.slug}"`),
      `关键词表里的 ${h.slug} 在 chains.ts 中不存在，命中后会跳到 404`
    );
  }
}

console.log("policy-hints: 7 组断言全过");