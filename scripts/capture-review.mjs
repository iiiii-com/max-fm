/** 截取产业地图与历史演进页，供重设计前评审 */
import { chromium } from "playwright-core";

const BASE = process.argv[2] || process.env.BASE_URL || "http://localhost:3000";
const EXE = "C:/Users/lenovo/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe";

const SHOTS = [
  ["/industry", "industry", 1440, 900],
  ["/industry", "industry", 390, 844],
  ["/history?tab=bullbear", "hist-bullbear", 1440, 900],
  ["/history?tab=waves", "hist-waves", 1440, 900],
  ["/history?tab=waves", "hist-waves", 390, 844],
  ["/history?tab=timeline", "hist-timeline", 1440, 900],
];

const browser = await chromium.launch({ executablePath: EXE, headless: true });

for (const [path, tag, w, h] of SHOTS) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.goto(BASE + path, { waitUntil: "domcontentloaded", timeout: 40000 });
  await page.waitForTimeout(6500);
  const info = await page.evaluate(() => ({
    height: document.body.scrollHeight,
    canvases: document.querySelectorAll("canvas").length,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }));
  await page.screenshot({ path: `C:/tmp/kz/r-${tag}-${w}.png`, fullPage: false });
  console.log(`${path.padEnd(26)} ${w}x${h}  高${String(info.height).padStart(6)} canvas${String(info.canvases).padStart(2)} 溢出${info.overflow}`);
  await page.close();
}

await browser.close();
