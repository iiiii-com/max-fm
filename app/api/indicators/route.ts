import { NextResponse } from "next/server";
import { getIndicators } from "@/lib/data/queries";
import { bootstrap } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  await bootstrap();
  const rows = await getIndicators();
  return NextResponse.json(
    rows.map((r: any) => ({ type: r.type, date: r.date, value: r.value })),
    {
      // 宏观指标是月/季度频数据，序列几乎不变；原先 no-store 让每次访问都重新传输
      // ~215KB 全量序列。这里给 5 分钟浏览器缓存 + 2 小时 CDN 缓存；
      // 真实同步（/api/tasks/run）后最多 2 小时会被 CDN 刷新，模块本身也会因重启失效。
      headers: { "Cache-Control": "public, max-age=300, s-maxage=7200" },
    },
  );
}