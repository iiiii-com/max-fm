/**
 * 优化后回归验证：确认数据按需加载改造后，图表/地图仍正常渲染且无报错。
 *
 * 覆盖：
 *   A. /analysis/bullbear —— 日线改为 fetch 后图表是否渲染 + 点击详情是否仍可用
 *   B. /map —— 地图 GeoJSON 改为 fetch 后是否渲染
 *   C. 数据接口是否被真正请求（证明走了按需加载而非打进 JS 包）
 *   D. 控制台错误
 *
 * 运行：NODE_PATH=<ws>/node_modules node scripts/verify-optimization.mjs [baseUrl]
 */
import { chromium } from "playwright-core";

const EXE = "C:/Users/lenovo/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe";
const BASE = process.argv[2] || "http://localhost:3121";

const browser = await chromium.launch({ executablePath: EXE, headless: true });

async function check(name, path, opts = {}) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = [];
  const requested = [];
  page.on("console", (m) => {
    if (m.type() === "error") errs.push(m.text().slice(0, 160));
  });
  page.on("pageerror", (e) => errs.push("PAGEERROR: " + String(e).slice(0, 160)));
  page.on("request", (r) => {
    const u = r.url();
    if (u.includes("/api/data/")) requested.push(u.split("/api/data/")[1]);
  });

  console.log(`\n=== ${name} (${path}) ===`);
  try {
    await page.goto(BASE + path, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(opts.wait ?? 7000);

    console.log(`  数据接口请求: ${requested.length ? requested.join(", ") : "（无）"}`);

    // canvas 数量 = 图表是否渲染
    const canvases = await page.evaluate(() =>
      [...document.querySelectorAll("canvas")].map((c) => {
        const r = c.getBoundingClientRect();
        return { w: Math.round(r.width), h: Math.round(r.height) };
      })
    );
    const big = canvases.filter((c) => c.w > 200 && c.h > 100);
    console.log(`  canvas 总数: ${canvases.length}，其中主图(>200x100): ${big.length}`);

    if (opts.clickChart) {
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
        const b = pick(svgs);
        return b && b.width > 300 ? b : pick([...document.querySelectorAll("canvas")]);
      });
      if (box) {
        await page.evaluate(() => {
          const el =
            [...document.querySelectorAll("svg.kline-ann-svg")].sort(
              (a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width
            )[0] || document.querySelector("canvas");
          el?.scrollIntoView({ block: "center" });
        });
        await page.waitForTimeout(500);
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
          const b = pick(svgs);
          return b && b.width > 300 ? b : pick([...document.querySelectorAll("canvas")]);
        });
        const t = box2 || box;
        // K 线是垂直线段：固定 y 会漏掉短实体，需二维网格搜索
        let ok = false;
        outer: for (let fy = 0.16; fy <= 0.62; fy += 0.08) {
          for (let fx = 0.15; fx <= 0.85; fx += 0.1) {
            await page.mouse.click(t.x + t.width * fx, t.y + t.height * fy);
            await page.waitForTimeout(160);
            ok = await page.evaluate(() => !!document.querySelector("[data-kline-detail]"));
            if (ok) {
              const txt = await page.evaluate(
                () => (document.querySelector("[data-kline-detail]")?.textContent || "").replace(/\s+/g, " ").trim().slice(0, 80)
              );
              console.log(`  K线点击详情: ✓ ${txt}`);
              break outer;
            }
          }
        }
        if (!ok) console.log("  K线点击详情: ✗ 未出现");
      }
    }

    const real = errs.filter((e) => !/favicon|DevTools|HMR|Failed to load resource|418/i.test(e));
    console.log(`  控制台: ${real.length ? "✗ " + real[0] : "✓ 无错误"}`);
  } catch (e) {
    console.log(`  ✗ 失败: ${String(e).slice(0, 100)}`);
  }
  await page.close();
}

await check("牛熊全景K线", "/analysis/bullbear", { clickChart: true });
await check("地图（产业地图）", "/map", { wait: 9000 });
await check("K线实验室", "/lab?secid=sh000001&name=%E4%B8%8A%E8%AF%81%E6%8C%87%E6%95%B0", { clickChart: true });

await browser.close();
console.log("\n完成");
