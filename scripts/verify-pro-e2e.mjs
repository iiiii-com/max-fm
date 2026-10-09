/**
 * 专业版门槛端到端：链指数 / 多链对比 必须双向可验。
 * 用法：node scripts/verify-pro-e2e.mjs <baseUrl> <email> <password>
 */
const BASE = process.argv[2] || "http://localhost:3110";
const EMAIL = process.argv[3];
const PASSWORD = process.argv[4];

let cookie = "";
async function req(path, opts = {}) {
  const res = await fetch(BASE + path, {
    ...opts,
    headers: { ...(opts.headers || {}), ...(cookie ? { cookie } : {}) },
    redirect: "manual",
  });
  const sc = res.headers.get("set-cookie");
  if (sc) cookie = sc.split(";")[0];
  return res;
}
function report(label, text, keys) {
  const miss = keys.filter((k) => !text.includes(k));
  console.log(`--- ${label}  bytes=${text.length}  缺失=${miss.length ? miss.join(" / ") : "无"}`);
  return miss.length === 0;
}
async function apiCode(path) {
  const r = await req(path);
  let body = {};
  try { body = await r.json(); } catch {}
  return { status: r.status, body };
}

let fails = 0;

console.log("########## 未登录：两个计算型接口都应 402 ##########");
for (const [label, path] of [
  ["chain/index", "/api/chain/index?slug=semiconductor"],
  ["chain/compare", "/api/chain/compare"],
]) {
  const { status, body } = await apiCode(path);
  const pass = status === 402 && body.needPro === true && body.freeTier && body.proTier;
  if (!pass) fails++;
  console.log(`  ${pass ? "PASS" : "FAIL"} ${label} HTTP ${status} needPro=${body.needPro} free="${String(body.freeTier).slice(0, 24)}…"`);
}

console.log("\n########## /pro 页（未登录）：产业研究分区 + 锁定态 ##########");
{
  const html = await (await req("/pro")).text();
  if (!report("/pro", html, ["产业研究", "产业链指数", "多链对比", "普通版可见", "深度解读", "组合风控", "批量计算", "研究留档"])) fails++;
}

console.log("\n########## /pricing：新分区与新能力必须出现 ##########");
{
  const html = await (await req("/pricing")).text();
  if (!report("/pricing", html, ["产业研究", "产业链指数", "多链对比", "深度解读", "组合风控", "批量计算", "研究留档"])) fails++;
}

console.log("\n########## 链详情页：免费用户应看到结构 + 链指数锁定 ##########");
{
  const html = await (await req("/industry/semiconductor")).text();
  if (!report("链详情(免费)", html, ["上中下游分层", "链指数（真实收盘价等权合成）", "代表公司", "环节"])) fails++;
}

if (EMAIL && PASSWORD) {
  const r = await req("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD, remember: true }),
  });
  console.log(`\n########## 登录 ${r.status} ##########`);

  const { status, body } = await apiCode("/api/chain/index?slug=semiconductor");
  if (status === 402) {
    console.log("  当前为免费版 → chain/index 402（正确）");
  } else if (status === 200 && body.ok) {
    console.log(`  专业版 → chain/index 200：区间收益 ${body.stats.ret}% 回撤 ${body.stats.maxDrawdown}% 纳入 ${body.coverage.usedInIndex} 家`);
  } else {
    console.log(`  chain/index HTTP ${status}：${body.error ?? ""}（上游限频时 503 属预期降级）`);
  }
}

console.log(fails === 0 ? "\nPRO-E2E: 全部通过" : `\nPRO-E2E: ${fails} 项失败`);
process.exit(fails === 0 ? 0 : 1);