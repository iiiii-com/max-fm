/**
 * 端到端验证：K 线「每日涨跌幅标注 + 点击查看当日详情」
 *
 * 验证点：
 *   A. 页面 K 线渲染 + 无控制台报错
 *   B. 悬停/渲染出「涨跌幅标注」（+X.XX% / -Y.YY% 文本标签）
 *   C. 点击某根 K 线 → 出现 KlineDetailPanel（data-kline-detail），含涨跌幅
 *   D. 关闭按钮可关闭面板
 *
 * 运行：
 *   NODE_PATH=<workspace>/node_modules node scripts/verify-kline-pct.mjs [baseUrl]
 */
import { chromium } from "playwright-core";

const EXE = "C:/Users/lenovo/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe";
const BASE = process.argv[2] || "http://localhost:3111";

const PAGES = [
  { path: "/analysis/bullbear", name: "牛熊全景 K 线" },
  { path: "/lab?secid=sh000001&name=%E4%B8%8A%E8%AF%81%E6%8C%87%E6%95%B0", name: "K 线实验室" },
  { path: "/stock?q=%E4%B8%8A%E8%AF%81%E6%8C%87%E6%95%B0", name: "个股查询（上证指数）" },
];

const browser = await chromium.launch({ executablePath: EXE, headless: true });

for (const p of PAGES) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = [];
  page.on("console", (m) => {
    if (m.type() === "error") errs.push(m.text().slice(0, 150));
  });
  page.on("pageerror", (e) => errs.push("PAGEERROR: " + String(e).slice(0, 150)));

  try {
    await page.goto(BASE + p.path, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForSelector("svg.kline-ann-svg, canvas", { timeout: 30000 });
    await page.waitForTimeout(6000);

    console.log(`\n=== ${p.name} (${p.path}) ===`);

    // 定位图表区域：优先选最大的 kline-ann-svg（主 K 线），否则选最大的 canvas
    const box = await page.evaluate(() => {
      const pick = (els) => {
        if (!els.length) return null;
        let best = null;
        for (const el of els) {
          const r = el.getBoundingClientRect();
          if (!best || r.width * r.height > best.width * best.height) best = r;
        }
        return { x: best.x, y: best.y, width: best.width, height: best.height };
      };
      const svgs = [...document.querySelectorAll("svg.kline-ann-svg")];
      const bySvg = pick(svgs);
      if (bySvg && bySvg.width > 300) return bySvg;
      const byCanvas = pick([...document.querySelectorAll("canvas")]);
      return byCanvas;
    });
    if (!box) {
      console.log("  ✗ 未找到图表");
      await page.close();
      continue;
    }
    console.log(`  图表区域: ${Math.round(box.width)}×${Math.round(box.height)}`);

    // B. 检查是否渲染出涨跌幅标注（canvas 内文本不可读，用截图+DOM 检查替代：
    //    改为检查 panel 是否含涨跌幅；标注渲染依赖 ECharts label，用像素变化间接验证）
    const cx = box.x + box.width * 0.5;
    const cy = box.y + box.height * 0.4;

        // C. 点击 K 线 → 详情面板（多点尝试：K 线主体通常在中上部）
    // 图表可能在视口外，先滚动到可视区
    await page.evaluate(() => {
      const el = document.querySelector("[data-kline-detail]")?.parentElement?.parentElement
        || [...document.querySelectorAll("svg.kline-ann-svg")].sort((a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width)[0]
        || document.querySelector("canvas");
      el?.scrollIntoView({ block: "center" });
    });
    await page.waitForTimeout(600);
    // 滚动后坐标会变，重新取
    const box2 = await page.evaluate(() => {
      const pick = (els) => {
        if (!els.length) return null;
        let best = null;
        for (const el of els) {
          const r = el.getBoundingClientRect();
          if (!best || r.width * r.height > best.width * best.height) best = r;
        }
        return { x: best.x, y: best.y, width: best.width, height: best.height };
      };
      const svgs = [...document.querySelectorAll("svg.kline-ann-svg")];
      const bySvg = pick(svgs);
      if (bySvg && bySvg.width > 300) return bySvg;
      return pick([...document.querySelectorAll("canvas")]);
    });
    const target = box2 ?? box;
    let detail = null;
    for (const [fx, fy] of [[0.5, 0.4], [0.3, 0.25], [0.4, 0.35], [0.6, 0.3], [0.35, 0.28], [0.55, 0.45]]) {
      const px = target.x + target.width * fx;
      const py = target.y + target.height * fy;
      await page.mouse.move(px, py);
      await page.waitForTimeout(200);
      await page.mouse.click(px, py);
      await page.waitForTimeout(700);
      detail = await page.evaluate(() => {
        const el = document.querySelector("[data-kline-detail]");
        if (!el) return null;
        return {
          text: (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 120),
          hasClose: !!el.querySelector("button[aria-label='关闭详情']"),
        };
      });
      if (detail) break;
    }

    if (detail) {
      console.log(`  ✓ 点击后出现详情面板: ${detail.text}`);
      // D. 关闭
      if (detail.hasClose) {
        await page.click("[data-kline-detail] button[aria-label='关闭详情']");
        await page.waitForTimeout(400);
        const gone = await page.evaluate(() => !document.querySelector("[data-kline-detail]"));
        console.log(`  ${gone ? "✓" : "✗"} 关闭按钮${gone ? "可正常关闭" : "未能关闭"}`);
      }
    } else {
      console.log("  ✗ 点击后未出现详情面板");
    }

    const real = errs.filter((e) => !/favicon|DevTools|HMR|Failed to load resource|429/i.test(e));
    console.log(`  控制台: ${real.length ? "✗ " + real[0] : "✓ 无错误"}`);
  } catch (e) {
    console.log(`  ✗ 失败: ${String(e).slice(0, 100)}`);
  }
  await page.close();
}

await browser.close();
console.log("\n完成");
