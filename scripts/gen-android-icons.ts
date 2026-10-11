/**
 * 生成 Android 启动图标（可重复运行）。
 *
 * Capacitor 生成的模板图标是它自己的占位图，必须替换成品牌图标，
 * 否则装到手机上是一个默认的 Capacitor logo —— 一眼就看出没做完。
 *
 * Android 的图标规格与 PWA 不同，必须按密度分别出图：
 *   mipmap-mdpi     48   hdpi   72   xhdpi   96
 *   xxhdpi         144   xxxhdpi 192
 * 另有 adaptive icon（Android 8+）：前景图要放在 108dp 画布上，
 * 但系统只显示中间 72dp —— 所以内容必须落在中心约 66% 的安全区，
 * 否则圆形裁切时字母四角会被切掉（与 PWA 的 maskable 同一道理）。
 *
 * 运行：npx tsx scripts/gen-android-icons.ts
 */
import sharp from "sharp";
import { writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const RES = join(process.cwd(), "mobile", "android", "app", "src", "main", "res");
const BRAND_FROM = "#d4203d";
const BRAND_TO = "#111111";

/** 传统图标（含背景与字母，系统不裁切） */
function legacySvg(size: number): string {
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

/** adaptive icon 的前景层：透明底 + 居中的字母（字母占 108dp 画布的 36%，落在安全区内） */
function foregroundSvg(size: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <text x="50%" y="50%" dy="0.35em" text-anchor="middle" font-family="Helvetica, Arial, sans-serif"
        font-weight="900" font-size="${size * 0.36}" fill="#ffffff">M</text>
</svg>`;
}

/** 背景层：纯品牌渐变铺满 */
function backgroundSvg(size: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="${BRAND_FROM}"/><stop offset="100%" stop-color="${BRAND_TO}"/>
  </linearGradient></defs>
  <rect width="${size}" height="${size}" fill="url(#g)"/>
</svg>`;
}

const DENSITIES: Array<[string, number]> = [
  ["mdpi", 48],
  ["hdpi", 72],
  ["xhdpi", 96],
  ["xxhdpi", 144],
  ["xxxhdpi", 192],
];

async function main() {
  if (!existsSync(RES)) {
    console.error("未找到 Android res 目录，先运行：cd mobile && npx cap add android");
    process.exit(1);
  }
  console.log("生成 Android 启动图标：");

  for (const [density, size] of DENSITIES) {
    const dir = join(RES, `mipmap-${density}`);
    mkdirSync(dir, { recursive: true });

    // 传统图标
    const legacy = await sharp(Buffer.from(legacySvg(size))).png().toBuffer();
    writeFileSync(join(dir, "ic_launcher.png"), legacy);
    writeFileSync(join(dir, "ic_launcher_round.png"), legacy);

    // adaptive 前景：画布是 108dp，对应密度下像素 = size * 108/48
    const fgSize = Math.round((size * 108) / 48);
    const fg = await sharp(Buffer.from(foregroundSvg(fgSize))).png().toBuffer();
    writeFileSync(join(dir, "ic_launcher_foreground.png"), fg);

    console.log(`  mipmap-${density.padEnd(8)} 图标 ${size}px  前景 ${fgSize}px`);
  }

  // adaptive 背景层（放在 drawable，覆盖模板里那份纯色 xml 的效果由 mipmap-anydpi-v26 引用）
  const bgSize = 432;
  const bg = await sharp(Buffer.from(backgroundSvg(bgSize))).png().toBuffer();
  writeFileSync(join(RES, "drawable", "ic_launcher_background.png"), bg);
  console.log(`  drawable/ic_launcher_background.png  ${bgSize}px`);

  console.log("\n注意：mipmap-anydpi-v26/ic_launcher.xml 引用的背景若仍指向 @drawable/ic_launcher_background（xml），");
  console.log("需要把该 xml 换成同名 png 或改引用。下面脚本会一并处理。");
}

main();