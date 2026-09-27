/** 快速控制台错误检查（页数少、等待短，避免超时） */
import { chromium } from "playwright-core";

const BASE = process.argv[2] || "http://localhost:3000";
const browser = await chromium.launch({
  executablePath: "C:/Users/lenovo/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe",
  headless: true,
});

const PAGES = process.argv.slice(3);
for (const p of PAGES) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = [];
  page.on("pageerror", (e) => errs.push("PAGEERROR: " + String(e).slice(0, 130)));
  page.on("console", (m) => {
    if (m.type() === "error") errs.push(m.text().slice(0, 130));
  });
  try {
    await page.goto(BASE + p, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(4500);
    const real = errs.filter((e) => !/favicon|DevTools|HMR|Failed to load resource|418/i.test(e));
    const st = await page.evaluate(() => ({
      ov: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      canvas: document.querySelectorAll("canvas").length,
      cards: document.querySelectorAll("button[aria-expanded]").length,
    }));
    console.log(`${p.padEnd(26)} 溢出${st.ov}px canvas${st.canvas} 可展开卡${st.cards}  ${real.length ? "✗ " + real[0] : "✓ 无错误"}`);
  } catch (e) {
    console.log(`${p.padEnd(26)} ✗ ${String(e).slice(0, 60)}`);
  }
  await page.close();
}
await browser.close();
