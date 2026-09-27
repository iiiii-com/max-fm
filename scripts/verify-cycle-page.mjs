/** 验证 /analysis/cycle-anatomy：图表渲染、内容完整、无控制台错误，并截图 */
import { chromium } from "playwright-core";

const BASE = process.argv[2] || process.env.BASE_URL || "http://localhost:3000";
const EXE = "C:/Users/lenovo/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe";

const browser = await chromium.launch({ executablePath: EXE, headless: true });

for (const [w, h, tag] of [[1440, 900, "desktop"], [390, 844, "mobile"]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  const errs = [];
  page.on("pageerror", (e) => errs.push("PAGEERROR: " + String(e).slice(0, 160)));
  page.on("console", (m) => {
    if (m.type() === "error") errs.push(m.text().slice(0, 160));
  });

  await page.goto(BASE + "/analysis/cycle-anatomy", { waitUntil: "domcontentloaded", timeout: 40000 });
  await page.waitForTimeout(9000);
  await page.screenshot({ path: `C:/tmp/kz/cycle-${tag}-top.png`, fullPage: false });

  // 触发懒加载
  for (let i = 0; i < 8; i++) {
    await page.evaluate(() => window.scrollBy(0, 1000));
    await page.waitForTimeout(350);
  }
  await page.waitForTimeout(2500);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(800);

  const r = await page.evaluate(() => {
    const txt = document.body.innerText;
    const canvases = [...document.querySelectorAll("canvas")].map((c) => {
      const b = c.getBoundingClientRect();
      return `${Math.round(b.width)}x${Math.round(b.height)}`;
    });
    return {
      height: document.body.scrollHeight,
      canvases,
      checks: {
        口径声明: txt.includes("数据口径声明"),
        对照表: txt.includes("复算值与外部口径对照"),
        偏差列: txt.includes("偏差"),
        熊市统计: txt.includes("检出熊市"),
        双向下跌修复: txt.includes("下跌时长 vs 修复时长"),
        深度排序: txt.includes("历次熊市深度排序"),
        口径敏感性: txt.includes("口径敏感性"),
        四大引擎: txt.includes("牛市驱动引擎"),
        六阶段: txt.includes("完整周期：六阶段闭环"),
        终结信号: txt.includes("牛市终结的预警信号"),
        六大规律: txt.includes("核心规律"),
        观点标识: txt.includes("研究框架 · 观点"),
        免责: txt.includes("不构成任何投资建议"),
      },
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });

  console.log(`\n=== ${tag} ${w}x${h} ===`);
  console.log(`  页面高度: ${r.height}px  横向溢出: ${r.overflow}px`);
  console.log(`  图表 canvas: ${r.canvases.length} 个 → ${r.canvases.join(", ")}`);
  const miss = Object.entries(r.checks).filter(([, v]) => !v).map(([k]) => k);
  console.log(`  内容检查: ${miss.length ? "✗ 缺失 " + miss.join("、") : "✓ 全部存在（13 项）"}`);
  const real = errs.filter((e) => !/favicon|DevTools|HMR|Failed to load resource|418/i.test(e));
  console.log(`  控制台: ${real.length ? "✗ " + real[0] : "✓ 无错误"}`);

  await page.screenshot({ path: `C:/tmp/kz/cycle-${tag}.png`, fullPage: false });
  await page.close();
}

await browser.close();
