import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { proGate } from "@/lib/plan";
import { toCsv, contentDisposition, isHeaderSafe, csvStamp } from "@/lib/data/csv";

export const dynamic = "force-dynamic";

/**
 * 研究结果导出（专业版）：把页面上的结论连同**口径与样本区间**一起落成 CSV。
 *
 * 为什么导出也要带上口径而不是只导数字：
 *   导出的表会离开这个页面、被贴进别的地方。如果只有数字没有窗口和样本数，
 *   半年后没人说得清这列是什么口径算出来的 —— 那这份留档就没有研究价值。
 *   所以每份 CSV 前几行固定是元信息注释（# 开头），下面是数据。
 *
 * CSV 注入防护：单元格以 = + - @ 开头时前置单引号。Excel/Sheets 会把
 * 这些当公式执行，标的名或备注里出现这类字符就会变成公式注入。
 */

function csvResponse(asciiName: string, utf8Name: string, body: string) {
  const disposition = contentDisposition(asciiName, utf8Name);
  // 自证不变量：头值必须是 Latin-1 可编码的。中文名漏了 RFC 5987 编码会在这里立刻炸，
  // 而不是等到运行时抛 "Cannot convert argument to a ByteString" 变成 500。
  if (!isHeaderSafe(disposition)) {
    throw new Error("Content-Disposition 含非 Latin-1 字符，文件名必须走 RFC 5987 编码");
  }
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": disposition,
      // 含用户数据与口径，不公开缓存
      "Cache-Control": "private, no-store",
    },
  });
}

export async function GET(req: Request) {
  const session = await getSession();
  const gate = proGate(session, "export");
  if (gate) return NextResponse.json(gate.body, { status: gate.status });

  const type = new URL(req.url).searchParams.get("type") ?? "diagnosis";

  if (type === "diagnosis") {
    const rows = (await db
      .select({ secid: s.watchlists.code, name: s.watchlists.name })
      .from(s.watchlists)
      .where(eq(s.watchlists.uid, session!.id))) as Array<{ secid: string; name: string | null }>;

    if (!rows.length) {
      return NextResponse.json({ ok: false, error: "自选列表为空，没有可导出的内容" }, { status: 400 });
    }

    // 直接复用组合诊断接口，保证导出结果与页面**完全一致**（不另算一套）
    const origin = new URL(req.url).origin;
    const res = await fetch(`${origin}/api/watchlist/diagnosis`, {
      headers: { cookie: req.headers.get("cookie") ?? "" },
      cache: "no-store",
      signal: AbortSignal.timeout(60000),
    });
    const j: any = await res.json();
    if (!res.ok || !j?.ok) {
      return NextResponse.json({ ok: false, error: j?.error ?? "组合诊断不可用，无法导出" }, { status: 502 });
    }

    const csv = toCsv(
      [
        "Max 财经 · 自选股组合诊断",
        `生成时间：${j.updated}`,
        `共同区间：${j.window.from} ~ ${j.window.to}（${j.window.sessions} 个交易日，年化因子 ${j.window.tradingDaysPerYear}）`,
        `纳入标的：${j.count} 只${j.truncated ? `（另有 ${j.truncated} 只超出上限未纳入）` : ""}`,
        `组合年化波动（等权）：${(j.portfolio.equalWeight * 100).toFixed(2)}%`,
        `组合年化波动（最小方差）：${(j.portfolio.minVariance * 100).toFixed(2)}%`,
        `有效标的数（1/HHI）：${j.portfolio.effectiveN} / ${j.count}`,
        j.topPair ? `最同涨同跌的一对：${j.topPair.a} × ${j.topPair.b}（ρ=${j.topPair.rho}）` : "最同涨同跌的一对：可算样本不足",
        `口径说明：${j.note}`,
        j.failed?.length ? `未纳入：${j.failed.join("；")}` : "全部标的均已纳入",
      ],
      ["代码", "名称", "年化波动", "日线根数", "最小方差权重"],
      j.assets.map((a: any, i: number) => [
        a.secid,
        a.name,
        (a.vol * 100).toFixed(2) + "%",
        a.bars,
        j.portfolio.minVarianceWeights?.[i] != null
          ? (j.portfolio.minVarianceWeights[i] * 100).toFixed(2) + "%"
          : "",
      ])
    );
    return csvResponse(`diagnosis-${csvStamp()}.csv`, `自选组合诊断-${csvStamp()}.csv`, csv);
  }

  if (type === "allocation") {
    const risk = Math.min(5, Math.max(1, Number(new URL(req.url).searchParams.get("risk") ?? 3)));
    const origin = new URL(req.url).origin;
    const res = await fetch(`${origin}/api/portfolio/risk?risk=${risk}`, {
      headers: { cookie: req.headers.get("cookie") ?? "" },
      cache: "no-store",
      signal: AbortSignal.timeout(60000),
    });
    const j: any = await res.json();
    if (!res.ok || !j?.ok) {
      return NextResponse.json({ ok: false, error: j?.error ?? "风险参数不可用，无法导出" }, { status: 502 });
    }

    const csv = toCsv(
      [
        "Max 财经 · SAA/TAA 配置比例",
        `生成时间：${j.updated}`,
        `风险偏好档位：${risk}（1 保守 ~ 5 进取）`,
        `样本区间：${j.window.from} ~ ${j.window.to}（${j.window.sessions} 个交易日，年化因子 ${j.window.tradingDaysPerYear}）`,
        `TAA 带宽口径：目标比例 ± 0.5 × 该资产年化波动`,
        `口径说明：${j.note}`,
        j.missing?.length ? `未取到：${j.missing.join("、")}` : "全部资产均已取到",
      ],
      ["资产", "年化波动", "目标比例", "偏离下限", "偏离上限"],
      [
        ...j.assets.map((a: any) => [
          a.name,
          (a.vol * 100).toFixed(2) + "%",
          (a.target * 100).toFixed(2) + "%",
          (a.band.low * 100).toFixed(2) + "%",
          (a.band.high * 100).toFixed(2) + "%",
        ]),
        ["固收类（框架设定）", "", (j.nonEquity.bond * 100).toFixed(2) + "%", "", ""],
        ["黄金等避险（框架设定）", "", (j.nonEquity.gold * 100).toFixed(2) + "%", "", ""],
        ["现金/活期（配平项）", "", (j.nonEquity.cash * 100).toFixed(2) + "%", "", ""],
      ]
    );
    return csvResponse(`allocation-risk${risk}-${csvStamp()}.csv`, `配置比例-风险${risk}-${csvStamp()}.csv`, csv);
  }

  if (type === "sector-rank") {
    const origin = new URL(req.url).origin;
    const bks = new URL(req.url).searchParams.get("bks");
    const res = await fetch(`${origin}/api/pro/sector-rank${bks ? `?bks=${encodeURIComponent(bks)}` : ""}`, {
      headers: { cookie: req.headers.get("cookie") ?? "" },
      cache: "no-store",
      signal: AbortSignal.timeout(90000),
    });
    const j: any = await res.json();
    if (!res.ok || !j?.ok) {
      return NextResponse.json({ ok: false, error: j?.error ?? "景气排行不可用，无法导出" }, { status: 502 });
    }

    const csv = toCsv(
      [
        "Max 财经 · 行业景气排行",
        `生成时间：${j.updated}`,
        `观测池：${j.count} 个板块（排名为池内相对位置，非全市场）`,
        `位置窗口：${j.window.positionWindow}，年化因子 ${j.window.annualization}`,
        `因子权重：${j.weighting}`,
        `口径说明：${j.note}`,
        j.degraded?.length ? `未纳入：${j.degraded.join("；")}` : "全部板块均已纳入",
      ],
      ["排名", "板块", "代码", "景气分", "位置分位", "20日动量", "60日动量", "年化波动", "日线根数", "区间起", "区间止"],
      j.items.map((r: any) => [
        `${r.rank}/${r.of}`,
        r.name,
        r.bk,
        r.score,
        r.position,
        r.momentum20 == null ? "" : r.momentum20 + "%",
        r.momentum60 == null ? "" : r.momentum60 + "%",
        r.vol20 + "%",
        r.bars,
        r.from,
        r.to,
      ])
    );
    return csvResponse(`sector-rank-${csvStamp()}.csv`, `行业景气排行-${csvStamp()}.csv`, csv);
  }

  return NextResponse.json(
    { ok: false, error: "type 需为 diagnosis / allocation / sector-rank", type },
    { status: 400 }
  );
}