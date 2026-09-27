/** 打印指定页面渲染后的标题结构，用于确认小节是否重复 */
import { chromium } from "playwright-core";

const BASE = process.argv[2] || "http://localhost:3000";
const PATH = process.argv[3] || "/";
const browser = await chromium.launch({
  executablePath: "C:/Users/lenovo/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe",
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errs = [];
page.on("pageerror", (e) => errs.push(String(e).slice(0, 120)));
page.on("console", (m) => {
  if (m.type() === "error") errs.push(m.text().slice(0, 120));
});

await page.goto(BASE + PATH, { waitUntil: "domcontentloaded", timeout: 40000 });
await page.waitForTimeout(11000);
for (let i = 0; i < 6; i++) {
  await page.evaluate(() => window.scrollBy(0, 1200));
  await page.waitForTimeout(400);
}
await page.waitForTimeout(1500);

const heads = await page.evaluate(() =>
  [...document.querySelectorAll("h2, h3")].map((h) => (h.textContent || "").trim()).filter((t) => t && t.length < 60)
);
console.log(`${PATH} 渲染后的标题（${heads.length}）：`);
heads.forEach((h) => console.log("  · " + h));
console.log(`控制台: ${errs.length ? "✗ " + errs[0] : "✓ 无错误"}`);
await browser.close();
