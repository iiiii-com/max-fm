/** 截取关键页面在桌面/移动视口下的首屏与关键区块，用于视觉评审 */
import { chromium } from "playwright-core";

const BASE = process.argv[2] || process.env.BASE_URL || "http://localhost:3000";
const EXE = "C:/Users/lenovo/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe";
const OUT = "C:/tmp/kz";

const SHOTS = [
  ["/", "home", 1440, 900, 0],
  ["/", "home", 390, 844, 0],
  ["/market", "market", 1440, 900, 0],
  ["/market", "market", 390, 844, 0],
  ["/lab", "lab", 1440, 900, 0],
  ["/analysis/bullbear", "bullbear", 1440, 900, 0],
  ["/macro", "macro", 1440, 900, 0],
];

const browser = await chromium.launch({ executablePath: EXE, headless: true });

for (const [path, tag, w, h, scroll] of SHOTS) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.goto(BASE + path, { waitUntil: "domcontentloaded", timeout: 40000 });
  await page.waitForTimeout(6000);
  if (scroll) {
    await page.evaluate((y) => window.scrollTo(0, y), scroll);
    await page.waitForTimeout(1500);
  }
  const file = `${OUT}/ui-${tag}-${w}.png`;
  await page.screenshot({ path: file, fullPage: false });
  console.log("saved", file);
  await page.close();
}

await browser.close();
