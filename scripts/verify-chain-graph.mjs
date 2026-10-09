/**
 * 跨链关系图谱自检。
 *
 * 这一层是"数据看着对、实际错"最容易发生的地方：
 * 度数算错、矩阵方向搞反、坏边被静默丢弃 —— 都不会报错，
 * 只会让页面显示一张看起来合理但关系是错的图。
 * 运行：node scripts/verify-chain-graph.mjs
 */
import assert from "node:assert/strict";
import { buildChainGraph, relationMatrix, hubs, onewayPairs, mutualPairs } from "../lib/data/chainGraph.ts";
import { STATIC_CHAINS } from "../lib/data/chains.ts";

const g = buildChainGraph(STATIC_CHAINS);

// 无坏边：relates 引用的 id 必须都存在（否则那条关系会静默消失）
{
  assert.deepEqual(g.danglingRefs, [], `存在指向不存在链的坏边：${g.danglingRefs.join(", ")}`);
}

// 基本守恒：双向对 + 单向对 = 去重后的无向边数
{
  assert.equal(
    g.mutualCount + g.onewayCount,
    g.undirectedCount,
    "每一条无向边要么双向要么单向，两者之和必须等于边数"
  );
  assert.ok(g.undirectedCount > 0, "关系图不应为空");
}

// 度数定义自洽：degree 必须等于 (出边 ∪ 入边) 去重后的规模
{
  const ids = new Set(STATIC_CHAINS.map((c) => c.id));
  for (const n of g.nodes) {
    const c = STATIC_CHAINS.find((x) => x.id === n.id);
    const outSet = new Set((c.relates ?? []).filter((r) => ids.has(r)));
    const inSet = new Set(
      STATIC_CHAINS.filter((x) => (x.relates ?? []).includes(n.id)).map((x) => x.id)
    );
    const union = new Set([...outSet, ...inSet]);
    assert.equal(n.degree, union.size, `${n.id} 度数不符`);
    assert.equal(n.out, outSet.size, `${n.id} 出度不符`);
    assert.equal(n.in, inSet.size, `${n.id} 入度不符`);
    // 度数不得超过节点总数 - 1
    assert.ok(n.degree <= g.nodes.length - 1, `${n.id} 度数超过上限`);
  }
}

// 自环必须被排除（链不应把自己当作关联链）
{
  const selfRefs = STATIC_CHAINS.filter((c) => (c.relates ?? []).includes(c.id));
  assert.equal(selfRefs.length, 0, `存在自环：${selfRefs.map((c) => c.id).join(", ")}`);
}

// 矩阵：对角线为 -1，取值只能是 -1/0/1/2，且与有向边一致
{
  const { ids, matrix } = relationMatrix(STATIC_CHAINS);
  assert.equal(ids.length, STATIC_CHAINS.length);
  assert.equal(matrix.length, ids.length);

  for (let i = 0; i < ids.length; i++) {
    assert.equal(matrix[i][i], -1, `${ids[i]} 对角线应为 -1（自身）`);
    for (let j = 0; j < ids.length; j++) {
      if (i === j) continue;
      assert.ok([0, 1, 2].includes(matrix[i][j]), `${ids[i]}→${ids[j]} 取值非法: ${matrix[i][j]}`);
    }
  }

  // 与原始数据逐格对拍
  const idx = new Map(ids.map((id, i) => [id, i]));
  const set = new Map(STATIC_CHAINS.map((c) => [c.id, new Set((c.relates ?? []).filter((r) => idx.has(r)))]));
  for (let i = 0; i < ids.length; i++) {
    for (let j = 0; j < ids.length; j++) {
      if (i === j) continue;
      const ab = set.get(ids[i]).has(ids[j]);
      const ba = set.get(ids[j]).has(ids[i]);
      const want = ab && ba ? 2 : ab ? 1 : 0;
      assert.equal(matrix[i][j], want, `矩阵 ${ids[i]}→${ids[j]} 应为 ${want}`);
    }
  }

  // 矩阵对称性：双向=2 必须对称，单向=1 必须反对称
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = matrix[i][j];
      const b = matrix[j][i];
      if (a === 2) assert.equal(b, 2, `${ids[i]}/${ids[j]} 双向关系必须对称`);
      if (a === 1) assert.equal(b, 0, `${ids[i]} 单向指向 ${ids[j]} 时反向必须为 0`);
      if (a === 0) assert.ok(b === 1 || b === 0, `${ids[i]} 无出边时反向只能是单向或空`);
    }
  }
}

// 枢纽榜：降序、不重复、长度受限
{
  const h = hubs(g, 5);
  assert.equal(h.length, 5);
  for (let i = 1; i < h.length; i++) {
    assert.ok(h[i - 1].degree >= h[i].degree, "枢纽榜必须按度数降序");
  }
  assert.equal(new Set(h.map((x) => x.id)).size, h.length, "枢纽榜不得重复");
  // 全站最高度数节点必须在榜首
  const maxDeg = Math.max(...g.nodes.map((n) => n.degree));
  assert.equal(h[0].degree, maxDeg);
}

// 单向对与双向对：不得把双向关系误算进单向
{
  const one = onewayPairs(STATIC_CHAINS, 999);
  const mut = mutualPairs(STATIC_CHAINS);
  assert.equal(one.length, g.onewayCount, "单向对数量必须与图统计一致");
  assert.equal(mut.length, g.mutualCount, "双向对数量必须与图统计一致");

  const mutKeys = new Set(mut.map((p) => [p.a, p.b].sort().join("|")));
  for (const p of one) {
    assert.notEqual(p.from, p.to, "单向对不得自指");
    assert.ok(
      !mutKeys.has([p.from, p.to].sort().join("|")),
      `${p.from}/${p.to} 是双向关系，不得出现在单向对里`
    );
  }
}

console.log(`chain-graph: 7 组断言全过（${g.nodes.length} 节点 / ${g.directedCount} 有向边 / ${g.undirectedCount} 无向边 / 双向 ${g.mutualCount} 单向 ${g.onewayCount}）`);