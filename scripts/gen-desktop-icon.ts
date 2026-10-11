/**
 * 生成桌面端图标（可重复运行）。
 *
 * electron-builder 接受 256×256 以上的 PNG 并自动转成 .ico，
 * 所以这里只出一张 512×512 的 PNG 即可，不必自己拼多尺寸 ico。
 *
 * 运行：npx tsx scripts/gen-desktop-icon.ts
 */
import sharp from "sharp";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT = join(process.cwd(), "desktop", "build");
const BRAND_FROM = "#d4203d";
const BRAND_TO = "#111111";

function svg(size: number): string {
  const r = size * 0.22;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="${BRAND_FROM}"/><stop offset="100%" stop-color="${BRAND_TO}"/>
  </linearGradient></defs>
  <rect width="${size}" height="${size}" rx="${r}" ry="${r}" fill="url(#g)"/>
  <text x="50%" y="50%" dy="0.35em" text-anchor="middle" font-family="Helvetica, Arial, sans-serif"
        font-weight="900" font-size="${size * 0.46}" fill="#ffffff">M</text>
</svg>`;
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const buf = await sharp(Buffer.from(svg(512))).png({ compressionLevel: 9 }).toBuffer();
  writeFileSync(join(OUT, "icon.png"), buf);
  console.log(`  desktop/build/icon.png  512×512  ${Math.round(buf.length / 1024)}KB`);
  console.log("electron-builder 会据此自动生成 .ico（Windows 安装包用）");
}

main();