import { NextRequest } from "next/server";
import { parseYmd, addDaysYmd, todayYmd } from "@/lib/date";

/**
 * 解析公共的 from/to 查询参数，默认近 30 天。
 * 注意：@db.Date 列在 Prisma 过滤时会按"日期"粒度比较（时间部分被忽略），
 * 因此所有日期过滤统一使用闭区间 gte=from / lte=to。
 */
export async function resolveRange(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const fromStr = sp.get("from");
  const toStr = sp.get("to");
  if (
    (fromStr && !/^\d{4}-\d{2}-\d{2}$/.test(fromStr)) ||
    (toStr && !/^\d{4}-\d{2}-\d{2}$/.test(toStr))
  ) {
    throw new Error("日期格式应为 yyyy-MM-dd");
  }
  const toStrFinal = toStr ?? todayYmd();
  const fromStrFinal =
    fromStr ?? addDaysYmd(toStrFinal, -29);
  if (fromStrFinal > toStrFinal) throw new Error("起始日期不能晚于结束日期");
  return {
    from: parseYmd(fromStrFinal),
    // 含结束日当天
    to: new Date(parseYmd(toStrFinal).getTime() + 24 * 3600 * 1000 - 1),
    fromStr: fromStrFinal,
    toStr: toStrFinal,
  };
}

export async function rangeGuard(req: NextRequest) {
  try {
    const r = await resolveRange(req);
    return { range: r, error: null as null };
  } catch (e) {
    return {
      range: null,
      error: (await import("next/server")).NextResponse.json(
        { error: e instanceof Error ? e.message : "参数错误" },
        { status: 400 }
      ),
    };
  }
}
