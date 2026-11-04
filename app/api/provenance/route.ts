import { NextResponse } from "next/server";
import { buildProvenanceReport, getProvenanceReport } from "@/lib/data/provenance";

/**
 * 数据溯源通道（机器可读）。
 *
 * `/provenance` 页面是给人看的；这个接口是给「外部系统 / 自动化巡检 / 未来的数据门禁」用的：
 * 拿到的是同一份清单 —— 每个数据集的行数、最近更新时间、状态、失真风险与建议动作。
 *
 * 例：
 *   curl https://www.lune.ink/api/provenance | jq '.summary'
 *   curl https://www.lune.ink/api/provenance | jq '.items[] | select(.status=="seed")'
 *
 * 带 `?fresh=1` 时跳过 60 秒缓存，用于刚跑完同步任务后立刻复核。
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const fresh = new URL(request.url).searchParams.get("fresh") === "1";
  try {
    const report = fresh ? await buildProvenanceReport() : await getProvenanceReport();
    return NextResponse.json(
      { ok: true, ...report },
      {
        headers: {
          "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=120",
          "X-Data-Dataset": "provenance",
          "X-Data-Trace": "/provenance",
        },
      }
    );
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "溯源报告生成失败", detail: String(e?.message ?? e).slice(0, 200) },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
