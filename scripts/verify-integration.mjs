/**
 * 验证两项改动：
 *   A. 产业地图分层流向图（替换力导向图）
 *   B. 历史演进页整合（节数减少、脉络导览、无重复）
 * 用法：node scripts/verify-integration.mjs [baseUrl]
 */
import { chromium } from "playwright-core";

const BASE = process.argv[2] || process.env.BASE_URL || "http://localhost:3000";
const EXE = "C:/Users/lenovo/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe";

const browser = await chromium.launch({ executablePath: EXE, headless: true });

async function open(path, w = 1440, h = 900) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  const errs = [];
  page.on("pageerror", (e) => errs.push("PAGEERROR: " + String(e).slice(0, 150)));
  page.on("console", (m) => {
    if (m.type() === "error") errs.push(m.text().slice(0, 150));
  });
  await page.goto(BASE + path, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(8000);
  return { page, errs };
}
const clean = (errs) => errs.filter((e) => !/favicon|DevTools|HMR|Failed to load resource|418/i.test(e));

/* ── A. 产业地图 ── */
{
  const { page, errs } = await open("/industry");
  const r = await page.evaluate(() => {
    const txt = document.body.innerText;
    const canvases = document.querySelectorAll("canvas").length;
    const chips = [...document.querySelectorAll('[role="tab"]')].map((b) => (b.textContent || "").trim());
    const cols = ["上游", "中游", "下游"].filter((l) => txt.includes(l));
    // 统计分层列的节点卡片数
    const cards = document.querySelectorAll("button[aria-expanded]").length;
    return { canvases, chipCount: chips.length, chipSample: chips.slice(0, 4), cols, cards, hasFlowTitle: txt.includes("分层流向图") };
  });
  console.log("=== A. 产业地图（/industry）===");
  console.log(`  canvas 数: ${r.canvases}（分层流向图用 HTML 渲染，应为 0）`);
  console.log(`  链选择 chip: ${r.chipCount} 个 → ${r.chipSample.join(" / ")}`);
  console.log(`  三层泳道: ${r.cols.join(" / ")}`);
  console.log(`  可展开环节卡片: ${r.cards} 个`);
  console.log(`  标题含「分层流向图」: ${r.hasFlowTitle ? "✓" : "✗"}`);

  // 点击第二个链 chip，验证切换即时生效且无跳动
  const switched = await page.evaluate(() => {
    const tabs = [...document.querySelectorAll('[role="tab"]')];
    if (tabs.length < 2) return null;
    const before = document.body.innerText.slice(0, 200);
    tabs[1].click();
    return { clicked: (tabs[1].textContent || "").trim(), before };
  });
  await page.waitForTimeout(1200);
  const after = await page.evaluate(() => {
    const sel = document.querySelector('[role="tab"][aria-selected="true"]');
    return (sel?.textContent || "").trim();
  });
  console.log(`  切换链: 点击「${switched?.clicked}」→ 选中态「${after}」`);
  console.log(`  控制台: ${clean(errs).length ? "✗ " + clean(errs)[0] : "✓ 无错误"}`);
  const ov = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  console.log(`  横向溢出: ${ov}px`);
  await page.screenshot({ path: "C:/tmp/kz/i-flow.png", fullPage: false });
  await page.close();
}

/* ── B. 历史演进 ── */
{
  const { page, errs } = await open("/history?tab=waves");
  const r = await page.evaluate(() => {
    const txt = document.body.innerText;
    // 只统计 waves tab 内的 SectionTitle（h2）
    const heads = [...document.querySelectorAll("h2")].map((h) => (h.textContent || "").trim());
    return {
      heads,
      hasGuide: txt.includes("牛熊周期（数月至一年）") || txt.includes("① 牛熊周期"),
      hasMergedKb: txt.includes("康波六波全景"),
      dupKb: txt.includes("康波六波全景对照"),
      hasPosMerge: txt.includes("当前位置与启示"),
      dupStandalone: txt.includes("我们站在哪里？"),
    };
  });
  console.log("\n=== B. 历史演进（/history?tab=waves）===");
  console.log(`  本页小节（${r.heads.length}）：`);
  r.heads.forEach((h) => console.log("    · " + h));
  console.log(`  脉络导览（①②③）: ${r.hasGuide ? "✓" : "✗"}`);
  console.log(`  康波两节已合并: ${r.hasMergedKb && !r.dupKb ? "✓" : "✗"}`);
  console.log(`  位置+启示已合并: ${r.hasPosMerge && !r.dupStandalone ? "✓" : "✗"}`);
  console.log(`  控制台: ${clean(errs).length ? "✗ " + clean(errs)[0] : "✓ 无错误"}`);
  await page.close();
}

/* ── 顺带回归：其他页面 ── */
console.log("\n=== 回归 ===");
for (const p of ["/", "/industry/nev", "/analysis/cycle-anatomy", "/history?tab=bullbear"]) {
  const { page, errs } = await open(p);
  const st = await page.evaluate(() => ({ h: document.body.scrollHeight, ov: document.documentElement.scrollWidth - document.documentElement.clientWidth }));
  const e = clean(errs);
  console.log(`  ${p.padEnd(28)} 高${String(st.h).padStart(5)} 溢出${st.ov}px  ${e.length ? "✗ " + e[0] : "✓ 无错误"}`);
  await page.close();
}

await browser.close();
