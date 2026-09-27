/**
 * 验证导航精简改动：
 *   1. 「产业地图」不再有下拉（无展开箭头、悬停不弹面板）
 *   2. 子项 ≥5 的板块下拉为双列（面板更矮）
 *   3. 新页「周期解剖」已进入「历史演进」下拉
 *   4. /analysis/cycle-anatomy 面包屑正确（此前只显示「首页」）
 *   5. 首页板块卡已补齐为 5 个，与导航一致
 *   6. 全站导航链接可达（无 404）
 *
 * 用法：node scripts/verify-nav.mjs [baseUrl]
 */
import { chromium } from "playwright-core";

const BASE = process.argv[2] || process.env.BASE_URL || "http://localhost:3000";
const EXE = "C:/Users/lenovo/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe";

const browser = await chromium.launch({ executablePath: EXE, headless: true });

/* ── 1~3：桌面端导航结构 ── */
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e).slice(0, 140)));
  page.on("console", (m) => {
    if (m.type() === "error") errs.push(m.text().slice(0, 140));
  });
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 40000 });
  await page.waitForTimeout(4000);

  const nav = await page.evaluate(() => {
    const items = [...document.querySelectorAll('nav[aria-label="主导航"] > div')];
    return items.map((el) => {
      const link = el.querySelector("a");
      const label = (link?.textContent || "").trim();
      const hasChevron = !!el.querySelector("svg");
      const panel = el.querySelector("div.absolute");
      const ul = panel?.querySelector("ul");
      const style = ul ? getComputedStyle(ul) : null;
      return {
        label,
        hasChevron,
        hasPanel: !!panel,
        gridCols: style?.gridTemplateColumns && style.gridTemplateColumns !== "none" ? style.gridTemplateColumns.split(" ").length : 1,
        childCount: ul ? ul.querySelectorAll("li").length : 0,
        panelWidth: panel ? Math.round(panel.querySelector("div")?.getBoundingClientRect().width || 0) : 0,
        children: ul ? [...ul.querySelectorAll("li a")].map((a) => (a.textContent || "").trim().slice(0, 22)) : [],
      };
    });
  });

  console.log("=== 桌面主导航结构 ===");
  nav.forEach((g) => {
    console.log(
      `  ${g.label.padEnd(6)} 子项${String(g.childCount).padStart(2)}  箭头:${g.hasChevron ? "有" : "无"}  下拉:${g.hasPanel ? "有" : "无"}` +
        `  ${g.hasPanel ? `列数:${g.gridCols} 宽:${g.panelWidth}px` : ""}`
    );
  });

  const industry = nav.find((g) => g.label === "产业地图");
  const market = nav.find((g) => g.label === "市场洞察");
  const history = nav.find((g) => g.label === "历史演进");

  console.log("\n=== 断言 ===");
  console.log(`  产业地图无下拉、无箭头: ${industry && !industry.hasPanel && !industry.hasChevron ? "✓" : "✗"}`);
  console.log(`  市场洞察下拉为双列: ${market && market.gridCols === 2 ? "✓" : "✗（当前 " + market?.gridCols + " 列）"}`);
  console.log(`  周期解剖已入历史演进下拉: ${history?.children.some((c) => c.includes("周期解剖")) ? "✓" : "✗"}`);

  const real = errs.filter((e) => !/favicon|DevTools|HMR|Failed to load resource|418/i.test(e));
  console.log(`  首页控制台: ${real.length ? "✗ " + real[0] : "✓ 无错误"}`);

  /* ── 5：首页板块卡数量 ── */
  const boards = await page.evaluate(() => {
    const h = [...document.querySelectorAll("h2")].find((x) => /[四五]大板块/.test(x.textContent || ""));
    const section = h?.closest("section");
    const text = section?.textContent || "";
    const groups = ["宏观总览", "市场洞察", "产业地图", "历史演进", "研究体系"];
    return { heading: (h?.textContent || "").trim(), groups: groups.map((g) => ({ g, present: text.includes(g) })) };
  });
  console.log("\n  首页板块标题: 「" + boards.heading + "」");
  const missing = boards.groups.filter((x) => !x.present).map((x) => x.g);
  console.log("  板块卡覆盖: " + (missing.length ? "✗ 缺少 " + missing.join("、") : "✓ 五个板块齐全"));

  await page.close();
}

/* ── 4：新页面面包屑 ── */
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(BASE + "/analysis/cycle-anatomy", { waitUntil: "domcontentloaded", timeout: 40000 });
  await page.waitForTimeout(3000);
  const crumbs = await page.evaluate(() => {
    // 面包屑的 aria-label 固定为「面包屑」，不能用 'nav' 兜底（会命中主导航）
    const nav = document.querySelector('nav[aria-label="面包屑"]');
    if (!nav) return "";
    return [...nav.querySelectorAll("li, a")].map((e) => (e.textContent || "").trim()).filter(Boolean).join(" / ");
  });
  console.log(`\n=== 面包屑 /analysis/cycle-anatomy ===\n  ${crumbs || "（未找到）"}`);
  console.log(`  包含「历史演进」: ${crumbs.includes("历史演进") ? "✓" : "✗"}`);
  console.log(`  包含「周期解剖」: ${crumbs.includes("周期解剖") ? "✓" : "✗"}`);
  await page.close();
}

/* ── 6：导航与首页链接可达性 ── */
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 40000 });
  await page.waitForTimeout(3000);
  const hrefs = await page.evaluate(() => {
    const out = new Set();
    document.querySelectorAll('header a[href^="/"], footer a[href^="/"]').forEach((a) => {
      const h = a.getAttribute("href");
      if (h && !h.startsWith("//")) out.add(h);
    });
    return [...out];
  });
  console.log(`\n=== 导航/页脚链接可达性（共 ${hrefs.length} 条）===`);
  let bad = 0;
  for (const h of hrefs) {
    const res = await page.request.get(BASE + h, { maxRedirects: 0 }).catch(() => null);
    const code = res?.status() ?? 0;
    if (code >= 400) {
      console.log(`  ✗ ${h} → ${code}`);
      bad++;
    }
  }
  console.log(bad ? `  ${bad} 条异常` : "  ✓ 全部可达");
  await page.close();
}

await browser.close();
