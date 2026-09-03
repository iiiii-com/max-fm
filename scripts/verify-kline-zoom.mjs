/**
 * 牛熊 K 线缩放 —— 真实浏览器端到端验证
 *
 * 验证点（对应用户 3 问）：
 *   A. 连续上滚能否持续放大（用「图像是否继续变化」判定，不依赖 ECharts 内部实例）
 *   B. 触达最细粒度时是否出现明确提示（检测 .kline-zoom-hint DOM）
 *   C. 最细粒度下拖拽平移是否仍然可用
 *   D. 控制台无报错
 *
 * 运行：
 *   NODE_PATH=<workspace>/node_modules node scripts/verify-kline-zoom.mjs [url]
 */
import { chromium } from "playwright-core";
import crypto from "node:crypto";

const EXE =
  "C:/Users/lenovo/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe";
const URL = process.argv[2] || "http://localhost:3111/analysis/bullbear";
const STEPS = 70; // 连续上滚次数

const hash = (buf) => crypto.createHash("md5").update(buf).digest("hex").slice(0, 10);

const browser = await chromium.launch({ executablePath: EXE, headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const errors = [];
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text().slice(0, 200));
});
page.on("pageerror", (e) => errors.push("PAGEERROR: " + String(e).slice(0, 200)));

// dev server 有 HMR 长连接，不能用 networkidle（会永不返回）
await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForSelector("svg.kline-ann-svg", { timeout: 60000 });
await page.waitForTimeout(4000); // 等 ECharts 首帧渲染完成

// ── 定位牛熊 K 线的画线层（滚轮事件正落在它上面）──
const target = await page.evaluate(() => {
  const h = [...document.querySelectorAll("h3")].find((el) =>
    (el.textContent || "").includes("牛熊全景")
  );
  const card = h?.closest("div[class*='rounded']") || h?.parentElement?.parentElement;
  const svg = card?.querySelector("svg.kline-ann-svg") || document.querySelector("svg.kline-ann-svg");
  if (!svg) return null;
  const r = svg.getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height };
});
if (!target) {
  console.error("❌ 未找到牛熊 K 线的画线层 svg.kline-ann-svg");
  await browser.close();
  process.exit(1);
}
console.log(`✓ 定位画线层: ${Math.round(target.w)}×${Math.round(target.h)} @ (${Math.round(target.x)},${Math.round(target.y)})`);

const cx = target.x + target.w / 2;
const cy = target.y + target.h / 2;
const clip = {
  x: Math.round(target.x),
  y: Math.round(target.y),
  width: Math.round(target.w),
  height: Math.round(Math.min(target.h, 400)),
};

await page.mouse.move(cx, cy);
const shot = async () => hash(await page.screenshot({ clip }));
const readHint = () =>
  page.evaluate(() => {
    const el = document.querySelector(".kline-zoom-hint");
    return el ? (el.textContent || "").trim() : null;
  });

// ── A/B：连续上滚，记录每一步画面是否变化 + 是否出现边界提示 ──
let prev = await shot();
let changed = 0;
let firstStuckStep = null;
let hintAt = null;
let hintText = null;
const marks = [];

for (let i = 1; i <= STEPS; i++) {
  await page.mouse.wheel(0, -120); // 上滚 = 放大
  await page.waitForTimeout(90);
  const cur = await shot();
  const h = await readHint();
  if (h && hintAt === null) {
    hintAt = i;
    hintText = h;
  }
  if (cur !== prev) {
    changed++;
    firstStuckStep = null;
  } else if (firstStuckStep === null) {
    firstStuckStep = i;
  }
  if ([5, 10, 20, 30, 40, 50, 60, 70].includes(i)) marks.push(`  第 ${String(i).padStart(2)} 步: ${cur !== prev ? "画面变化 ✓" : "画面不变 ✗"}${h ? " | 提示: " + h : ""}`);
  prev = cur;
  // 画面连续 8 步不再变化 → 认定已到缩放极限，提前结束
  if (firstStuckStep !== null && i - firstStuckStep >= 8) {
    marks.push(`  （第 ${firstStuckStep} 步起画面连续 8 次无变化，提前终止）`);
    break;
  }
}
console.log("\n【A】连续上滚放大");
console.log(marks.join("\n"));
console.log(`  实际生效的缩放步数: ${changed} / ${STEPS}`);

console.log("\n【B】最细粒度反馈");
if (hintText) console.log(`  ✓ 第 ${hintAt} 步出现提示: 「${hintText}」`);
else console.log("  ✗ 全程未出现任何边界提示（静默失效）");

// ── C：最细粒度下拖拽平移 ──
console.log("\n【C】最细粒度下拖拽平移");
const beforePan = await shot();
await page.mouse.move(cx, cy);
await page.mouse.down();
for (let k = 1; k <= 8; k++) {
  await page.mouse.move(cx - k * 30, cy);
  await page.waitForTimeout(45);
}
await page.mouse.up();
await page.waitForTimeout(350);
const afterPan = await shot();
console.log(`  拖拽后画面: ${afterPan !== beforePan ? "已变化 ✓ 平移可用" : "未变化 ✗ 平移失效"}`);

// ── D：控制台 ──
console.log("\n【D】控制台错误");
const real = errors.filter((e) => !/favicon|Download the React DevTools|HMR/i.test(e));
console.log(real.length ? `  ✗ ${real.length} 条:\n${real.map((e) => "    " + e).join("\n")}` : "  ✓ 无错误");

await browser.close();

console.log("\n──────── 结论 ────────");
console.log(`缩放生效步数 ${changed} | 边界提示 ${hintText ? "有" : "无"} | 最细粒度平移 ${afterPan !== beforePan ? "可用" : "失效"}`);
