/** 动态详情页冒烟（industry / history） */
import { chromium } from "playwright-core";

const BASE = process.argv[2] || process.env.BASE_URL || "http://localhost:3000";

const browser = await chromium.launch({
  executablePath: "C:/Users/lenovo/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe",
  headless: true,
});

const PATHS = ["/industry/nev", "/industry/semiconductor", "/industry/ai", "/history/tulip-mania", "/history/south-sea-bubble"];

for (const p of PATHS) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e).slice(0, 140)));
  page.on("console", (m) => {
    if (m.type() === "error") errs.push(m.text().slice(0, 140));
  });
  try {
    const res = await page.goto(BASE + p, { waitUntil: "domcontentloaded", timeout: 40000 });
    await page.waitForTimeout(2500);
    const real = errs.filter((e) => !/favicon|DevTools|HMR|Failed to load resource|418/i.test(e));
    const hasContent = await page.evaluate(() => document.body.innerText.length > 300);
    const ok = res && res.status() === 200 && hasContent;
    console.log(
      (ok ? "✓ " : "✗ ") + p.padEnd(30) + " HTTP " + (res ? res.status() : 0) + "  内容:" + (hasContent ? "有" : "空") + "  控制台:" + (real.length ? "✗ " + real[0] : "✓ 无错误")
    );
  } catch (e) {
    console.log("✗ " + p + " " + String(e).slice(0, 60));
  }
  await page.close();
}

await browser.close();
