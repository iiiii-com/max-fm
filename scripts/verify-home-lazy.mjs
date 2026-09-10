/**
 * 验证首页按需加载改造后功能完好：
 *   1. 仪表盘四卡正常渲染
 *   2. 默认表格视图可用
 *   3. 切到「条形图」时 ECharts 才下载并成功渲染
 *   4. 无控制台错误
 */
import { chromium } from "playwright-core";

const BASE = process.argv[2] || process.env.BASE_URL || "http://localhost:3000";

const browser = await chromium.launch({
  executablePath: "C:/Users/lenovo/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe",
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errs = [];
page.on("pageerror", (e) => errs.push("PAGEERROR: " + String(e).slice(0, 180)));
page.on("console", (m) => {
  if (m.type() === "error") errs.push(m.text().slice(0, 180));
});

await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 40000 });
await page.waitForTimeout(8000);

console.log("1) 首屏 canvas（应为 0，ECharts 未加载）:", await page.evaluate(() => document.querySelectorAll("canvas").length));

const cards = await page.evaluate(() => {
  const t = document.body.innerText;
  return {
    overview: t.includes("行情速览"),
    heatmap: t.includes("全球热力"),
    macro: t.includes("宏观仪表"),
    sector: t.includes("板块资金"),
    tableRows: document.querySelectorAll("table tbody tr").length,
  };
});
console.log("2) 四张卡片:", JSON.stringify(cards));

// 切到条形图
const clicked = await page.evaluate(() => {
  const btn = [...document.querySelectorAll("button")].find((b) => (b.textContent || "").trim() === "条形图");
  if (btn) {
    btn.scrollIntoView({ block: "center" });
    btn.click();
    return true;
  }
  return false;
});
console.log("3) 点击「条形图」:", clicked ? "已点击" : "未找到按钮");

await page.waitForTimeout(6000);
const after = await page.evaluate(() => ({
  canvas: document.querySelectorAll("canvas").length,
  sizes: [...document.querySelectorAll("canvas")].map((c) => {
    const r = c.getBoundingClientRect();
    return `${Math.round(r.width)}x${Math.round(r.height)}`;
  }),
}));
console.log("   切换后 canvas:", after.canvas, JSON.stringify(after.sizes));

const real = errs.filter((e) => !/favicon|DevTools|HMR|Failed to load resource|418/i.test(e));
console.log("4) 控制台:", real.length ? "✗ " + real[0] : "✓ 无错误");

await page.screenshot({ path: "C:/tmp/kz/home-bar.png", fullPage: false });
await browser.close();
