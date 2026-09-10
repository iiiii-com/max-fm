import { NextResponse } from "next/server";
import chinaGeo from "@/data/china-geo.json";

/**
 * 中国地图 GeoJSON
 *
 * 同 sh-index：该文件约 582KB，原先在客户端组件 `ChinaMap.tsx` 顶层 import 并 registerMap，
 * 会被整体打进客户端 JS 包（实测单个 chunk 603KB，约占全部客户端 JS 的 16%）。
 * 改为运行时按需 fetch：
 *   - 仅访问地图相关页面时才下载，其它页面不承担该体积
 *   - 走 CDN 强缓存，二次访问零成本
 *   - 避免作为 JS 解析（GeoJSON 作为对象字面量解析远慢于 JSON.parse）
 */
export const dynamic = "force-static";

export async function GET() {
  return NextResponse.json(chinaGeo, {
    headers: {
      // 行政区划边界为静态数据，长期不变
      "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400",
    },
  });
}
