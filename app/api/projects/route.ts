import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiAuth, badRequest } from "@/lib/api-helpers";

export async function GET() {
  const { user, error } = await apiAuth();
  if (error) return error;

  const projects = await db.project.findMany({
    where: { userId: user.id },
    orderBy: [{ archived: "asc" }, { createdAt: "asc" }],
    include: { _count: { select: { tasks: true } } },
  });

  return NextResponse.json({ projects });
}

export async function POST(req: NextRequest) {
  const { user, error } = await apiAuth();
  if (error) return error;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return badRequest("请求格式错误");
  const { name, color } = body as Record<string, unknown>;

  if (typeof name !== "string" || !name.trim()) return badRequest("项目名不能为空");

  const project = await db.project.create({
    data: {
      name: name.trim(),
      color:
        typeof color === "string" && /^#[0-9a-fA-F]{6}$/.test(color)
          ? color
          : "#6366f1",
      userId: user.id,
    },
  });

  return NextResponse.json({ project }, { status: 201 });
}
