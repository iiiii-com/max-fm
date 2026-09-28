import { NextRequest, NextResponse } from "next/server";
import { LeaveType } from "@prisma/client";
import { db } from "@/lib/db";
import { apiAuth, badRequest } from "@/lib/api-helpers";
import { parseYmd } from "@/lib/date";

const LEAVE_TYPES = Object.values(LeaveType) as string[];

export async function GET() {
  const { user, error } = await apiAuth();
  if (error) return error;

  const leaves = await db.leaveRequest.findMany({
    where: { userId: user.id },
    orderBy: { startDate: "desc" },
  });
  return NextResponse.json({ leaves });
}

export async function POST(req: NextRequest) {
  const { user, error } = await apiAuth();
  if (error) return error;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return badRequest("请求格式错误");
  const { type, startDate, endDate, reason } = body as Record<string, unknown>;

  if (typeof type !== "string" || !LEAVE_TYPES.includes(type))
    return badRequest("请假类型错误");

  let start: Date;
  let end: Date;
  try {
    if (typeof startDate !== "string" || typeof endDate !== "string")
      throw new Error();
    start = parseYmd(startDate);
    end = parseYmd(endDate);
  } catch {
    return badRequest("日期格式应为 yyyy-MM-dd");
  }
  if (end < start) return badRequest("结束日期不能早于开始日期");

  // 与已有请假重叠检查
  const overlap = await db.leaveRequest.findFirst({
    where: {
      userId: user.id,
      status: { not: "REJECTED" },
      startDate: { lte: end },
      endDate: { gte: start },
    },
  });
  if (overlap) return badRequest("与已有请假记录时间重叠");

  const leave = await db.leaveRequest.create({
    data: {
      userId: user.id,
      type: type as LeaveType,
      startDate: start,
      endDate: end,
      reason: typeof reason === "string" && reason ? reason : null,
    },
  });

  return NextResponse.json({ leave }, { status: 201 });
}
