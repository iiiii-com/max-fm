/** 截取产业地图新流线图（桌面 + 移动），并核对交互 */
import { chromium } from "playwright-core";

const BASE = process.argv[2] || "http://localhost:3220";
const browser = await chromium.launch({
  executablePath: "C:/Users/lenovo/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe",
  headless: true,
});

// 桌面
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e).slice(0, 130)));
  page.on("console", (m) => {
    if (m.type() === "error") errs.push(m.text().slice(0, 130));
  });
  await page.goto(BASE + "/industry", { waitUntil: "domcontentloaded", timeout: 40000 });
  await page.waitForTimeout(7000);

  const info = await page.evaluate(() => {
    const svg = document.querySelector('svg[aria-label="产业链布线图"]');
    const paths = svg ? svg.querySelectorAll("path").length : 0;
    const pills = svg ? svg.querySelectorAll("g[role=button]").length : 0;
    const chips = document.querySelectorAll('[role="tab"]').length;
    return { hasSvg: !!svg, paths, pills, chips, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  });
  console.log("=== 桌面 /industry ===");
  console.log(`  弧形流线 SVG: ${info.hasSvg ? "✓" : "✗"}  弧线 ${info.paths} 条  节点胶囊 ${info.pills} 个  链 chip ${info.chips} 个`);
  console.log(`  横向溢出: ${info.overflow}px`);

  // 悬停一个节点，检查链路高亮。
  // 注意：必须用真实鼠标移动 —— React 的 onMouseEnter 由 mouseover 委托合成，
  // 直接 dispatchEvent(new MouseEvent("mouseenter")) 不会触发。
  const beforeOp = await page.evaluate(() =>
    [...document.querySelectorAll('svg[aria-label="产业链布线图"] path')].map((p) => p.getAttribute("opacity"))
  );
  const box = await page.evaluate(() => {
    const g = document.querySelector('svg[aria-label="产业链布线图"] g[role=button]');
    if (!g) return null;
    const r = g.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  if (box) {
    await page.mouse.move(box.x, box.y);
    await page.waitForTimeout(500);
  }
  const afterOp = await page.evaluate(() =>
    [...document.querySelectorAll('svg[aria-label="产业链布线图"] path')].map((p) => p.getAttribute("opacity"))
  );
  const changed = beforeOp.filter((v, i) => v !== afterOp[i]).length;
  console.log(`  悬停高亮: ${changed}/${beforeOp.length} 条弧线透明度发生变化`);

  // 点击节点看详情卡
  if (box) { await page.mouse.click(box.x, box.y); await page.waitForTimeout(600); }
  const openRes = await page.evaluate(async () => {
    return document.body.innerText.includes("点击其他环节可切换");
  });
  console.log(`  点击展开详情卡: ${openRes ? "✓" : "✗"}`);

  await page.screenshot({ path: "C:/tmp/kz/arc-desktop.png", fullPage: false });
  console.log(`  控制台: ${errs.length ? "✗ " + errs[0] : "✓ 无错误"}`);
  await page.close();
}

// 移动
{
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(BASE + "/industry", { waitUntil: "domcontentloaded", timeout: 40000 });
  await page.waitForTimeout(6000);
  const r = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    svgHidden: (() => {
      const svg = document.querySelector('svg[aria-label="产业链布线图"]');
      const wrap = svg?.parentElement;
      return wrap ? getComputedStyle(wrap).display === "none" : null;
    })(),
  }));
  console.log("\n=== 移动 390 ===");
  console.log(`  横向溢出: ${r.overflow}px  桌面版 SVG 已隐藏: ${r.svgHidden ? "✓（改用纵向排布）" : "✗"}`);
  await page.screenshot({ path: "C:/tmp/kz/arc-mobile.png", fullPage: false });
  await page.close();
}

await browser.close();
