/**
 * 生成 PWA 应用图标（可重复运行）。
 *
 * 为什么用脚本而不是手放几张图：
 *   图标要覆盖 192 / 512 / maskable / apple-touch 四种规格，手改一处就得重新导出四张；
 *   而且品牌色一改（--primary 在暗色档是橙 #f28c00）图标就过时了。
 *   脚本化后 `npx tsx scripts/gen-icons.ts` 即可重建，规格与安全区都有据可查。
 *
 * maskable 的关键：Android 会把图标裁成圆形/方形，内容必须落在**中心 80% 安全区**内，
 * 否则 "M" 的四个角会被切掉。所以 maskable 版背景铺满、字母缩小。
 *
 * 运行：npx tsx scripts/gen-icons.ts
 */
import sharp from "sharp";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT = join(process.cwd(), "public", "icons");

/** 品牌渐变：与站内 logo 的 from-[#d4203d] to-[--primary-dark] 保持一致 */
const BRAND_FROM = "#d4203d";
const BRAND_TO = "#111111";

/**
 * 图标底：圆角方块 + 渐变 + 白色 M。
 * @param bleed 是否铺满整张画布（maskable 需要，普通图标留圆角）
 * @param scale 字母相对画布的比例（maskable 要更小以躲开裁切）
 */
function svg(size: number, bleed: boolean, scale: number): string {
  const r = bleed ? 0 : size * 0.22;
  const fontSize = size * scale;
  const gid = `g${size}${bleed ? "b" : "n"}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${BRAND_FROM}"/>
      <stop offset="100%" stop-color="${BRAND_TO}"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${r}" ry="${r}" fill="url(#${gid})"/>
  <text x="50%" y="50%" dy="0.35em" text-anchor="middle"
        font-family="Helvetica, Arial, sans-serif" font-weight="900"
        font-size="${fontSize}" fill="#ffffff">M</text>
</svg>`;
}

async function write(name: string, size: number, bleed: boolean, scale: number) {
  const buf = await sharp(Buffer.from(svg(size, bleed, scale))).png({ compressionLevel: 9 }).toBuffer();
  writeFileSync(join(OUT, name), buf);
  console.log(`  ${name.padEnd(28)} ${size}×${size}  ${Math.round(buf.length / 1024)}KB`);
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  console.log("生成 PWA 图标：");

  // 普通图标：圆角方块，字母占 46%
  await write("icon-192.png", 192, false, 0.46);
  await write("icon-512.png", 512, false, 0.46);

  // maskable：铺满 + 字母缩到 36%，落在中心 80% 安全区内
  await write("maskable-512.png", 512, true, 0.36);

  // iOS 主屏图标：iOS 自己加圆角，所以给方形铺满的版本
  await write("apple-touch-icon.png", 180, true, 0.44);

  console.log("\n完成。图标与 app/manifest.ts 中的声明必须一致，改尺寸记得两边同步。");
}

main();