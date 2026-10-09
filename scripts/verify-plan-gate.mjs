/**
 * 版本边界自检：普通版不得拿到专业版数据，专业版不得被误裁。
 * 运行：node scripts/verify-plan-gate.mjs
 */
import assert from "node:assert/strict";
import {
  planOf, isPro, proGate, maskForPro, PRO_FEATURES, PRO_FEATURE_MAP,
  proFeaturesByGroup, PRO_GROUP_ORDER, isAdmin, adminGate,
} from "../lib/plan.ts";

const free = { plan: "free" };
const pro = { plan: "pro" };

// 版本判定：未登录/null 一律 free，不因缺失字段提权
{
  assert.equal(planOf(free), "free");
  assert.equal(planOf(pro), "pro");
  assert.equal(planOf(null), "free");
  assert.equal(planOf(undefined), "free");
  assert.equal(planOf({ plan: "PRO" }), "free", "大小写不符必须当 free，不能宽松匹配");
  assert.equal(planOf({ plan: "" }), "free");
  assert.equal(isPro(free), false);
  assert.equal(isPro(pro), true);
}

// 门禁：免费 402、专业放行；402 必须带能力说明（前端据此显示升级引导）
{
  assert.equal(proGate(pro, "policy-deep"), null, "专业版必须放行");
  const res = proGate(free, "policy-deep");
  assert.ok(res, "免费版必须被拦");
  assert.equal(res.status, 402, "用 402 而不是 403：语义是「需要付费」");
  const body = res.body;
  assert.equal(body.ok, false);
  assert.equal(body.needPro, true);
  assert.equal(body.feature, "policy-deep");
  assert.ok(body.freeTier, "必须告诉免费用户他已经能看到什么");
  assert.ok(body.proTier, "必须说明专业版多出什么");
}

// 未登录同样被拦（不能因为没登录就放行）
{
  assert.ok(proGate(null, "batch-diagnosis"));
}

// 降级：免费裁掉专业字段并报告 locked；专业原样返回
{
  const full = { target: 0.4, corr: [[1]], equityRisk: { equalWeight: 0.14 } };
  const g = maskForPro(free, full, ["corr", "equityRisk"]);
  assert.equal("corr" in g.data, false, "免费版不得拿到相关矩阵");
  assert.equal("equityRisk" in g.data, false);
  assert.equal(g.data.target, 0.4, "结论必须保留，不能连结论一起藏");
  assert.deepEqual(g.locked.sort(), ["corr", "equityRisk"]);

  const p = maskForPro(pro, full, ["corr", "equityRisk"]);
  assert.deepEqual(p.data, full, "专业版不得被误裁");
  assert.deepEqual(p.locked, []);

  // 字段本来就不存在时不应被记成 locked（否则前端会显示不存在的锁定项）
  const none = maskForPro(free, { target: 0.4 }, ["corr"]);
  assert.deepEqual(none.locked, []);
}

// 注册表自洽：key 唯一、非空、模块路径以 / 开头
{
  const keys = PRO_FEATURES.map((f) => f.key);
  assert.equal(new Set(keys).size, keys.length, "能力 key 不得重复");
  for (const f of PRO_FEATURES) {
    assert.ok(f.key && f.name && f.free && f.pro, `能力 ${f.key} 说明不完整`);
    assert.ok(!/看不到|不可用|无法查看/.test(f.free), `「${f.key}」的免费说明不能写成"看不到"，必须写清能看到什么`);
    for (const m of f.modules) assert.ok(m.startsWith("/"), `模块路径 ${m} 必须以 / 开头`);
  }
  assert.equal(Object.keys(PRO_FEATURE_MAP).length, keys.length);
}

// 未知能力也能被拦住（不能因为没注册就放行）
{
  const res = proGate(free, "not-registered");
  assert.ok(res, "未注册的能力也必须拦截");
  assert.equal(res.status, 402);
}

// 分区：每项能力必须属于已定义分区，且分区聚合不丢项、不产生空分区
{
  for (const f of PRO_FEATURES) {
    assert.ok(
      PRO_GROUP_ORDER.includes(f.group),
      `能力 ${f.key} 的分区「${f.group}」不在 PRO_GROUP_ORDER 里`
    );
  }
  const grouped = proFeaturesByGroup();
  assert.equal(
    grouped.reduce((a, g) => a + g.items.length, 0),
    PRO_FEATURES.length,
    "分区聚合不得丢项"
  );
  assert.ok(grouped.every((g) => g.items.length > 0), "空分区不应返回");
  // 分区顺序必须与 PRO_GROUP_ORDER 一致，否则界面顺序会随数据变化漂移
  const order = grouped.map((g) => g.group);
  assert.deepEqual(order, PRO_GROUP_ORDER.filter((g) => order.includes(g)));
}

// 管理员：未配置 ADMIN_EMAILS 时必须**没有任何人**是管理员（fail closed）
{
  const backup = process.env.ADMIN_EMAILS;
  delete process.env.ADMIN_EMAILS;
  assert.equal(isAdmin({ email: "anyone@example.com" }), false, "未配置白名单时不能放行任何人");
  assert.equal(isAdmin(null), false);

  process.env.ADMIN_EMAILS = "  Boss@Example.com , ops@example.com ";
  assert.equal(isAdmin({ email: "boss@example.com" }), true, "邮箱比对不区分大小写与空格");
  assert.equal(isAdmin({ email: "OPS@EXAMPLE.COM" }), true);
  assert.equal(isAdmin({ email: "boss@example.com.evil.com" }), false, "不得前缀/后缀宽松匹配");
  assert.equal(isAdmin({ email: "ops@example.com " }), true, "会话邮箱带空格也要能匹配");
  assert.equal(isAdmin({ email: "nobody@example.com" }), false);

  process.env.ADMIN_EMAILS = "";
  assert.equal(isAdmin({ email: "boss@example.com" }), false, "白名单为空串 = 无人是管理员");

  if (backup === undefined) delete process.env.ADMIN_EMAILS;
  else process.env.ADMIN_EMAILS = backup;
}

// 管理员门禁：未登录 401 / 非管理员 403（与 proGate 的 402 明确区分）
{
  assert.equal(adminGate(null)?.status, 401);
  const backup = process.env.ADMIN_EMAILS;
  process.env.ADMIN_EMAILS = "boss@example.com";
  assert.equal(adminGate({ email: "user@example.com" })?.status, 403);
  assert.equal(adminGate({ email: "boss@example.com" }), null, "管理员必须放行");
  if (backup === undefined) delete process.env.ADMIN_EMAILS;
  else process.env.ADMIN_EMAILS = backup;
}

// 已交付的能力必须有模块入口；规划中的不得宣称已交付
{
  for (const f of PRO_FEATURES) {
    if (f.ready) assert.ok(f.modules.length > 0, `已交付能力 ${f.key} 必须给出可点开的模块`);
  }
  const exportFeature = PRO_FEATURE_MAP["export"];
  assert.ok(exportFeature?.ready, "导出已实现，注册表必须标 ready（否则 pricing 页会写「规划中」而实际能用）");
}

// 产业研究分区：链指数与多链对比都必须是服务端计算型能力，且各自有门禁 key
{
  const chain = PRO_FEATURES.filter((f) => f.group === "产业研究");
  assert.ok(chain.length >= 2, "产业研究分区应至少有链指数与多链对比两项");
  assert.ok(PRO_FEATURE_MAP["chain-index"]?.ready, "链指数已实现");
  assert.ok(PRO_FEATURE_MAP["chain-compare"]?.ready, "多链对比已实现");
  // 免费说明必须写清"能看到什么"，不能写成"看不到"
  for (const f of chain) {
    assert.ok(f.free.length > 8, `${f.key} 的免费说明过于简略`);
    assert.ok(!/看不到|不可用/.test(f.free), `${f.key} 的免费说明不能写成"看不到"`);
  }
}

// 门槛必须落在服务端：链指数与多链对比的 API 路由里必须调用 proGate
{
  const fs = await import("node:fs");
  for (const [key, file] of [
    ["chain-index", "app/api/chain/index/route.ts"],
    ["chain-compare", "app/api/chain/compare/route.ts"],
  ]) {
    const src = fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
    assert.ok(
      // 注意别用 [^)]* —— proGate(await getSession(), "key") 的参数里本身含括号
      new RegExp(`proGate\\([^\\n]*"${key}"`).test(src),
      `${file} 必须用 proGate("${key}") 做服务端门禁 —— 只在前端藏等于没锁`
    );
  }
}

console.log("plan-gate: 12 组断言全过");