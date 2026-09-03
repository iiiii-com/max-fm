/**
 * 回归冒烟：所有共用「画线标注层」的图表页面
 * 检查：页面可渲染 / 画线层存在 / 滚轮缩放能生效 / 无控制台报错
 */
import { chromium } from "playwright-core";
import crypto from "node:crypto";

const EXE = "C:/Users/lenovo/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe";
const BASE = process.argv[2] || "http://localhost:3111";
const PAGES = [
  { path: "/analysis/bullbear", name: "牛熊全景 K 线" },
  { path: "/lab", name: "K 线实验室" },
  { path: "/stock", name: "个股查询" },
];
const hash = (b) => crypto.createHash("md5").update(b).digest("hex").slice(0, 10);

const browser = await chromium.launch({ executablePath: EXE, headless: true });

for (const p of PAGES) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = [];
  page.on("console", (m) => m.type() === "error" && errs.push(m.text().slice(0, 160)));
  page.on("pageerror", (e) => errs.push("PAGEERROR: " + String(e).slice(0, 160)));
  try {
    await page.goto(BASE + p.path, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(3500);
    const svg = await page.$("svg.kline-ann-svg");
    let zoom = "—";
    if (svg) {
      const box = await svg.boundingBox();
      if (box) {
        const clip = {
          x: Math.round(box.x),
          y: Math.round(box.y),
          width: Math.round(box.width),
          height: Math.round(Math.min(box.height, 300)),
        };
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        const before = hash(await page.screenshot({ clip }));
        for (let i = 0; i < 6; i++) {
          await page.mouse.wheel(0, -120);
          await page.waitForTimeout(110);
        }
        const after = hash(await page.screenshot({ clip }));
        zoom = after !== before ? "✓ 生效" : "✗ 无变化";
      }
    }
    const real = errs.filter((e) => !/favicon|DevTools|HMR|Failed to load resource/i.test(e));
    console.log(
      `${p.name.padEnd(14)} ${p.path.padEnd(22)} 画线层:${svg ? "✓" : "—"}  缩放:${zoom}  控制台:${real.length ? "✗ " + real[0] : "✓ 无错误"}`
    );
  } catch (e) {
    console.log(`${p.name.padEnd(14)} ${p.path.padEnd(22)} ✗ 访问失败: ${String(e).slice(0, 80)}`);
  }
  await page.close();
}
await browser.close();
