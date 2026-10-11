/**
 * 生成 Windows .ico（多尺寸，可重复运行）。
 *
 * 为什么需要它：electron-builder 在无法使用 winCodeSign（内含 rcedit）时，
 * 不能自动把 PNG 转成 ico。而 .ico 是 Windows 可执行文件图标的唯一格式，
 * rcedit 只接受 .ico。
 *
 * ICO 格式本身很简单，不必为此引入依赖：
 *   头部 6 字节（保留位 0 / 类型 1 / 图像数 N）
 *   每张图 16 字节目录项（宽、高、调色板、保留、色深、位深、数据长度、数据偏移）
 *   然后是各尺寸的图像数据。尺寸 ≥ 256 时允许直接内嵌 PNG，
 *   小尺寸用 BMP 也行，但统一内嵌 PNG 更省事且现代 Windows 全支持。
 *
 * 尺寸覆盖 Windows 各处用途：16(任务栏小图标) 32(任务栏) 48(桌面) 64 128 256(大图标/属性页)。
 *
 * 运行：npx tsx scripts/gen-ico.ts
 */
import sharp from "sharp";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const OUT_DIR = join(process.cwd(), "desktop", "build");
const OUT = join(OUT_DIR, "icon.ico");
const SIZES = [16, 32, 48, 64, 128, 256];

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
  mkdirSync(OUT_DIR, { recursive: true });

  const pngs = await Promise.all(
    SIZES.map((s) => sharp(Buffer.from(svg(s))).png({ compressionLevel: 9 }).toBuffer())
  );

  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // 保留
  header.writeUInt16LE(1, 2); // 类型：1 = 图标
  header.writeUInt16LE(pngs.length, 4);

  const dir = Buffer.alloc(16 * pngs.length);
  let offset = header.length + dir.length;

  pngs.forEach((png, i) => {
    const b = i * 16;
    // 256 在目录项里写 0（该字段只有 1 字节，0 表示 256）
    dir.writeUInt8(SIZES[i] >= 256 ? 0 : SIZES[i], b + 0);
    dir.writeUInt8(SIZES[i] >= 256 ? 0 : SIZES[i], b + 1);
    dir.writeUInt8(0, b + 2); // 调色板数
    dir.writeUInt8(0, b + 3); // 保留
    dir.writeUInt16LE(1, b + 4); // 色彩平面
    dir.writeUInt16LE(32, b + 6); // 位深
    dir.writeUInt32LE(png.length, b + 8);
    dir.writeUInt32LE(offset, b + 12);
    offset += png.length;
  });

  const ico = Buffer.concat([header, dir, ...pngs]);
  writeFileSync(OUT, ico);
  console.log(`  desktop/build/icon.ico  ${SIZES.join("/")}  ${Math.round(ico.length / 1024)}KB`);
}

main();