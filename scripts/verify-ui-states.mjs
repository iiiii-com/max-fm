/**
 * 验证统一状态组件在真实故障下的表现
 *
 * 手法：用 Playwright route 拦截数据接口并强制返回 500 / 空数据，
 * 检查页面是否给出【可辨识的错误提示 + 重试出口】，而不是静默空白或灰色文字。
 *
 * 覆盖：NewsPanel(/api/news/flash)、GlobalHeatmap(/api/global/heatmap)、
 *       LeaderKlineGrid(/api/stock/kline)
 */
import { chromium } from "playwright-core";

const BASE = process.argv[2] || process.env.BASE_URL || "http://localhost:3000";
const EXE = "C:/Users/lenovo/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe";

const browser = await chromium.launch({ executablePath: EXE, headless: true });

/** 在故障注入下打开页面，检查是否出现 role=alert 与「重试」按钮 */
async function checkFailure(name, path, blockPattern, waitMs = 9000) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  let blocked = 0;
  await page.route(blockPattern, (route) => {
    blocked++;
    route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ ok: false, error: "模拟故障" }) });
  });

  await page.goto(BASE + path, { waitUntil: "domcontentloaded", timeout: 40000 });
  await page.waitForTimeout(waitMs);

  const r = await page.evaluate(() => {
    const alerts = [...document.querySelectorAll('[role="alert"]')];
    const visible = alerts.filter((el) => {
      const b = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return b.width > 0 && b.height > 0 && s.display !== "none";
    });
    const hasRetry = [...document.querySelectorAll("button")].some((b) =>
      /重试|重新加载|刷新/.test((b.textContent || "").trim())
    );
    // 错误文字是否真的呈红色（对比令牌是否生效）
    const isRed = (c) => {
      const m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      return m && Number(m[1]) > 150 && Number(m[2]) < 120 && Number(m[3]) < 120;
    };
    let reddish = 0;
    for (const el of visible) {
      // 红色可能落在子孙节点（提示文字），需一并检查
      const nodes = [el, ...el.querySelectorAll("*")];
      if (nodes.some((n) => isRed(getComputedStyle(n).color))) reddish++;
    }
    return {
      alertCount: visible.length,
      alertText: visible.map((e) => (e.textContent || "").replace(/\s+/g, " ").trim().slice(0, 60)),
      hasRetry,
      reddish,
    };
  });

  console.log(`\n=== ${name}（注入 500 故障，拦截 ${blocked} 次）===`);
  console.log(`  role="alert" 可见元素: ${r.alertCount}`);
  if (r.alertText.length) console.log(`  提示文案: ${r.alertText.join(" | ")}`);
  console.log(`  呈红色的错误提示: ${r.reddish}`);
  console.log(`  存在重试入口: ${r.hasRetry ? "✓" : "✗"}`);
  await page.close();
  return r;
}

await checkFailure("市场 · 财经快讯", "/market", "**/api/news/flash*");
await checkFailure("首页 · 全球热力", "/", "**/api/global/heatmap*");
await checkFailure("市场 · 国际指数迷你走势", "/market", "**/api/global/kline*");
await checkFailure("个股 · 迷你K线网格", "/stock?q=%E8%B4%B5%E5%B7%9E%E8%8C%85%E5%8F%B0", "**/api/stock/kline*");

await browser.close();
console.log("\n完成");
