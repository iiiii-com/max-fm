/**
 * 专业版路径端到端检查（全程 node，避免 PowerShell 编码把 UTF-8 搞成乱码）。
 * 用法：node scripts/verify-pro-e2e.mjs <baseUrl> <email> <password>
 * 注意：这是**集成**自检，需要先起 dev server 与一个可控测试账号；
 * 纯逻辑自检（plan-gate / csv / nav-breadcrumbs）不依赖服务器，优先跑那些。
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
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";")[0];
  return res;
}

function report(label, text, keys) {
  const miss = keys.filter((k) => !text.includes(k));
  console.log(`--- ${label}  bytes=${text.length}  缺失=${miss.length ? miss.join(" / ") : "无"}`);
  return miss.length === 0;
}

let ok = true;

// 未登录
{
  const res = await req("/pro");
  const html = await res.text();
  ok &= report("未登录 /pro", html, ["专业版工作台", "深度解读", "组合风控", "批量计算", "研究留档", "普通版", "专业版"]);
  // 锁定态断言的是 ProGate 实际渲染的内容。两种变体文案不同：
  //   compact（/pro 的分区内嵌面板用）→ 标记「普通版可见」+ 链接「了解专业版」
  //   非 compact（政策页、配置面板用）→ 链接是「查看专业版全部能力」
  // 另外 "该能力属于专业版" 只在 API 的 402 响应体里，不在页面 HTML 中。
  ok &= report("未登录 /pro 锁定态", html, ["政策深度解读", "行业景气排行", "研究结果导出", "普通版可见"]);
}

// 登录
if (EMAIL && PASSWORD) {
  const res = await req("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD, remember: true }),
  });
  console.log("login:", res.status, JSON.stringify(await res.json()).slice(0, 80));
}

// 已登录（当前 plan 由调用方在 DB 里控制）
{
  const res = await req("/pro");
  const html = await res.text();
  ok &= report("登录后 /pro", html, ["专业版工作台", "已交付", "普通版", "专业版"]);
  const isPro = html.includes("已开通");
  console.log(`    识别为专业版: ${isPro}`);
  if (isPro) {
    ok &= report("专业版操作面", html, [
      "最新机构视角解读",
      "行业景气排行",
      "研究结果导出",
      "下载 CSV",
    ]);
    // 「含趋势研判」只在政策确有趋势研判时才渲染（库里 detail 可能为 null），
    // 所以不断言它存在，只断言两个操作面板都在。
  } else {
    ok &= report("免费版锁定态", html, ["普通版可见", "了解专业版"]);
  }
}

// 面包屑
{
  const html = await (await req("/pro")).text();
  const crumb = /<nav[^>]*aria-label="面包屑"[^>]*>([\s\S]*?)<\/nav>/i.exec(html);
  console.log("面包屑:", crumb ? crumb[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 80) : "(未找到 nav)");
}

console.log(ok ? "\nPRO-E2E: 全部通过" : "\nPRO-E2E: 有缺失项");
process.exit(ok ? 0 : 1);