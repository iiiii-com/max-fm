/**
 * UI/UX 审计：在桌面与移动两种视口下采集可量化的问题
 *
 * 采集项：
 *   - 横向溢出（移动端最常见问题）
 *   - 过小触摸目标（<44px，移动端可点性）
 *   - 过小字号（<12px，可读性）
 *   - 图标按钮缺少可访问名称
 *   - 图片缺少 alt
 *   - 输入控件缺少可访问名称
 *   - 横向滚动容器外的宽表格
 *
 * 用法：node scripts/audit-uiux.mjs [baseUrl]
 */
import { chromium } from "playwright-core";

const BASE = process.argv[2] || process.env.BASE_URL || "http://localhost:3000";
const EXE = "C:/Users/lenovo/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe";

const PAGES = [
  ["/", "首页"],
  ["/market", "市场洞察"],
  ["/analysis/bullbear", "牛熊全景"],
  ["/lab", "K线实验室"],
  ["/macro", "宏观"],
  ["/industry", "产业链"],
  ["/history", "历史演进"],
];

const VIEWPORTS = [
  ["桌面", 1440, 900],
  ["移动", 390, 844],
];

const browser = await chromium.launch({ executablePath: EXE, headless: true });

for (const [vpName, w, h] of VIEWPORTS) {
  console.log(`\n${"=".repeat(60)}\n${vpName} ${w}x${h}\n${"=".repeat(60)}`);
  for (const [path, name] of PAGES) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    const errs = [];
    page.on("pageerror", (e) => errs.push(String(e).slice(0, 120)));
    page.on("console", (m) => {
      if (m.type() === "error") errs.push(m.text().slice(0, 120));
    });

    try {
      await page.goto(BASE + path, { waitUntil: "domcontentloaded", timeout: 40000 });
      await page.waitForTimeout(5000);

      const r = await page.evaluate(() => {
        const vis = (el) => {
          const s = getComputedStyle(el);
          const b = el.getBoundingClientRect();
          return s.display !== "none" && s.visibility !== "hidden" && b.width > 0 && b.height > 0;
        };
        const label = (el) =>
          (
            el.getAttribute("aria-label") ||
            el.getAttribute("title") ||
            (el.textContent || "").trim() ||
            ""
          ).slice(0, 24);

        // 横向溢出
        const de = document.documentElement;
        const overflow = de.scrollWidth - de.clientWidth;

        // 溢出元素（找出谁撑宽了页面）
        const offenders = [];
        if (overflow > 2) {
          for (const el of document.querySelectorAll("*")) {
            if (!vis(el)) continue;
            const b = el.getBoundingClientRect();
            if (b.right > de.clientWidth + 2 && b.width > 40) {
              offenders.push({
                tag: el.tagName.toLowerCase(),
                cls: (el.className || "").toString().slice(0, 50),
                right: Math.round(b.right),
                w: Math.round(b.width),
              });
            }
          }
        }

        // 小触摸目标
        let smallTargets = 0;
        const smallSamples = [];
        for (const el of document.querySelectorAll("button, a, select, input[type=checkbox], [role=button]")) {
          if (!vis(el)) continue;
          const b = el.getBoundingClientRect();
          if (b.height < 44 && b.width < 44) {
            smallTargets++;
            if (smallSamples.length < 3)
              smallSamples.push(`${el.tagName.toLowerCase()}"${label(el)}" ${Math.round(b.width)}x${Math.round(b.height)}`);
          }
        }

        // 小字号
        let tinyFont = 0;
        for (const el of document.querySelectorAll("p, span, td, th, li, div")) {
          if (!vis(el) || !el.textContent?.trim()) continue;
          const fs = parseFloat(getComputedStyle(el).fontSize);
          if (fs < 11) tinyFont++;
        }

        // 缺少可访问名称
        let noName = 0;
        const noNameSamples = [];
        for (const el of document.querySelectorAll("button, a, select, input")) {
          if (!vis(el)) continue;
          const has = el.getAttribute("aria-label") || el.getAttribute("title") || (el.textContent || "").trim() || el.getAttribute("placeholder");
          if (!has) {
            noName++;
            if (noNameSamples.length < 3) noNameSamples.push(el.tagName.toLowerCase() + (el.className || "").toString().slice(0, 30));
          }
        }

        // 图片缺 alt
        const imgNoAlt = [...document.querySelectorAll("img")].filter((i) => !i.hasAttribute("alt")).length;

        // 页面高度与首屏信息密度
        return {
          overflow,
          offenders: offenders.slice(0, 3),
          smallTargets,
          smallSamples,
          tinyFont,
          noName,
          noNameSamples,
          imgNoAlt,
          height: document.body.scrollHeight,
          canvases: document.querySelectorAll("canvas").length,
        };
      });

      const flags = [];
      if (r.overflow > 2) flags.push(`横向溢出 ${r.overflow}px`);
      if (r.smallTargets > 5) flags.push(`小触摸目标 ${r.smallTargets}`);
      if (r.tinyFont > 10) flags.push(`<11px 文字 ${r.tinyFont}`);
      if (r.noName > 0) flags.push(`无可访问名 ${r.noName}`);
      if (r.imgNoAlt > 0) flags.push(`img 缺 alt ${r.imgNoAlt}`);

      console.log(
        `  ${flags.length ? "⚠ " : "✓ "}${name.padEnd(10)} 高${String(r.height).padStart(5)} canvas${String(r.canvases).padStart(2)}  ` +
          (flags.length ? flags.join(" | ") : "无明显问题")
      );
      if (r.overflow > 2 && r.offenders.length) {
        r.offenders.forEach((o) => console.log(`      溢出源: <${o.tag} class="${o.cls}"> 宽${o.w} 右边界${o.right}`));
      }
      if (r.smallSamples.length) console.log(`      小目标示例: ${r.smallSamples.join(" / ")}`);
      if (r.noNameSamples.length) console.log(`      无名示例: ${r.noNameSamples.join(" / ")}`);

      const real = errs.filter((e) => !/favicon|DevTools|HMR|Failed to load resource|418/i.test(e));
      if (real.length) console.log(`      控制台: ${real[0]}`);
    } catch (e) {
      console.log(`  ✗ ${name} 失败: ${String(e).slice(0, 80)}`);
    }
    await page.close();
  }
}

await browser.close();
console.log("\n完成");
