import { NextResponse } from "next/server";
import shIndex from "@/data/sh-index.json";

/**
 * 上证综指日线数据（8536 根，1990-12-19 ~ 2026-08-21）
 *
 * 为什么单独开接口而不在客户端组件里直接 import：
 * 该 JSON 原始体积约 677KB，直接 import 会被打进客户端 JS 包（实测占单个 chunk 637KB，
 * 相当于全部客户端 JS 的 16%），造成首屏下载与解析双重负担。
 * 改为运行时按需 fetch 后：
 *   - JS 包体积下降 637KB（数据不再作为 JS 解析，改为 JSON 解析，快得多）
 *   - 数据走独立请求，可被 CDN 与浏览器缓存（immutable）
 *   - 可被 gzip/brotli 压缩传输（体量相近但解析成本显著降低）
 */
export const dynamic = "force-static";

export async function GET() {
  return NextResponse.json(shIndex, {
    headers: {
      // 数据源为静态历史日线（截至 2026-08-21），内容不变，可长期强缓存
      "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400",
    },
  });
}
