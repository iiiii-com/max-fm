/**
 * 验证移动端折叠：移动端页面变短、展开可用，桌面端高度不受影响。
 * 用法：node scripts/verify-collapse.mjs [baseUrl]
 */
import { chromium } from "playwright-core";

const BASE = process.argv[2] || process.env.BASE_URL || "http://localhost:3000";
const EXE = "C:/Users/lenovo/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe";

const browser = await chromium.launch({ executablePath: EXE, headless: true });

async function measure(w, h, label) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.goto(BASE + "/market", { waitUntil: "domcontentloaded", timeout: 40000 });
  await page.waitForTimeout(9000);
  const before = await page.evaluate(() => document.body.scrollHeight);

  // 找折叠按钮并展开
  const btn = await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((x) => /展开全部/.test(x.textContent || ""));
    if (!b) return null;
    const r = b.getBoundingClientRect();
    const visible = r.width > 0 && r.height > 0 && getComputedStyle(b).display !== "none";
    b.scrollIntoView({ block: "center" });
    return { visible, text: (b.textContent || "").trim(), ariaExpanded: b.getAttribute("aria-expanded") };
  });

  console.log(`\n=== ${label} ${w}x${h} ===`);
  console.log(`  页面高度: ${before}px`);
  console.log(`  可见「展开全部」按钮: ${btn ? (btn.visible ? "✓ " + btn.text : "存在但不可见(桌面端隐藏)") : "无"}`);
  if (btn) console.log(`  aria-expanded: ${btn.ariaExpanded}`);

  if (btn && btn.visible) {
    await page.evaluate(() => {
      const b = [...document.querySelectorAll("button")].find((x) => /展开全部/.test(x.textContent || ""));
      b?.click();
    });
    await page.waitForTimeout(800);
    const after = await page.evaluate(() => document.body.scrollHeight);
    console.log(`  展开后高度: ${after}px（+${after - before}）`);
  }
  await page.close();
  return before;
}

const m = await measure(390, 844, "移动");
const d = await measure(1440, 900, "桌面");

await browser.close();
console.log("\n对比：移动端折叠后 " + m + "px / 桌面端 " + d + "px");
