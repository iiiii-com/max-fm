/**
 * 70 城商品住宅销售价格指数（国家统计局月度发布）。
 *
 * GET /api/city/house-price
 *
 * 缓存：1 小时。统计局按月发布，同月数据不会变；但抓取脚本是手动触发的，
 * 数据期会跨月更新，因此缓存不宜过长。
 *
 * 数据缺失的 18 城**不返回近似值**，前端按 CITY_HOUSE_PRICE_SCOPE 显式说明
 * 「不在国家统计局 70 城统计范围」—— 拿邻近城市或均价填充会制造假精确。
 */
import { NextResponse } from "next/server";
import { getCityHousePrices } from "@/lib/data/queries";
import { bootstrap } from "@/lib/db";
import { cached } from "@/lib/data/upstream-cache";

export const dynamic = "force-dynamic";

const TTL = 60 * 60 * 1000;

export async function GET() {
  try {
    const out = await cached("city-house-price", TTL, async () => {
      await bootstrap();
      const { period, sourceUrl, byCity } = await getCityHousePrices();
      return {
        ok: true,
        period,
        sourceUrl,
        cities: Object.fromEntries(byCity),
      };
    });
    return NextResponse.json(out.data ?? { ok: false, error: "数据暂不可用" });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}