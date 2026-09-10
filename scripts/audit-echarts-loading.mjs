/**
 * 检查 ECharts（约 796KB chunk）是否在「无图表页面」被加载。
 * 若被加载，说明它在共享 chunk 中，可通过动态导入显著降低非图表页首屏成本。
 */
import { chromium } from "playwright-core";

const EXE = "C:/Users/lenovo/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe";
const BASE = process.argv[2] || process.env.BASE_URL || "http://localhost:3000";

const PAGES = ["/", "/policy", "/history", "/about", "/disclaimer", "/market", "/analysis/bullbear", "/map"];

const browser = await chromium.launch({ executablePath: EXE, headless: true });

// 先找出 ECharts 所在 chunk 的文件名（含 echarts 特征字符串）
const probe = await browser.newPage();
await probe.goto(BASE + "/analysis/bullbear", { waitUntil: "domcontentloaded" });
await probe.waitForTimeout(6000);
const echartsChunks = await probe.evaluate(() => {
  const out = [];
  for (const r of performance.getEntriesByType("resource")) {
    if (r.name.endsWith(".js") && r.transferSize > 300 * 1024) out.push(r.name.split("/").pop());
  }
  return out;
});
console.log("体积 >300KB 的 chunk（牛熊页）：", echartsChunks.join(", "));
await probe.close();

for (const p of PAGES) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(BASE + p, { waitUntil: "domcontentloaded", timeout: 40000 });
  await page.waitForTimeout(6000);
  const info = await page.evaluate(() => {
    const js = performance.getEntriesByType("resource").filter((r) => r.name.endsWith(".js"));
    const total = js.reduce((s, r) => s + (r.transferSize || r.encodedBodySize || 0), 0);
    const big = js.filter((r) => (r.transferSize || r.encodedBodySize || 0) > 300 * 1024).map((r) => r.name.split("/").pop());
    const canvases = document.querySelectorAll("canvas").length;
    return { jsCount: js.length, totalKB: Math.round(total / 1024), big, canvases };
  });
  console.log(
    `${p.padEnd(20)} JS ${String(info.jsCount).padStart(3)} 个 / 传输 ${String(info.totalKB).padStart(5)}KB  图表canvas:${String(info.canvases).padStart(2)}  大chunk:${info.big.length ? info.big.join(",") : "无"}`
  );
  await page.close();
}

await browser.close();
