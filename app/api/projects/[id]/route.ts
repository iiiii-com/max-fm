import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiAuth, badRequest } from "@/lib/api-helpers";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { user, error } = await apiAuth();
  if (error) return error;

  const { id } = await params;
  const project = await db.project.findFirst({
    where: { id, userId: user.id },
  });
  if (!project)
    return NextResponse.json({ error: "项目不存在" }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return badRequest("请求格式错误");
  const { name, color, archived } = body as Record<string, unknown>;

  const data: Record<string, unknown> = {};
  if (name !== undefined) {
    if (typeof name !== "string" || !name.trim())
      return badRequest("项目名不能为空");
    data.name = name.trim();
  }
  if (color !== undefined) {
    if (typeof color !== "string" || !/^#[0-9a-fA-F]{6}$/.test(color))
      return badRequest("颜色格式应为 #RRGGBB");
    data.color = color;
  }
  if (archived !== undefined) {
    if (typeof archived !== "boolean") return badRequest("参数错误");
    data.archived = archived;
  }

  const updated = await db.project.update({ where: { id }, data });
  return NextResponse.json({ project: updated });
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { user, error } = await apiAuth();
  if (error) return error;

  const { id } = await params;
  const project = await db.project.findFirst({
    where: { id, userId: user.id },
  });
  if (!project)
    return NextResponse.json({ error: "项目不存在" }, { status: 404 });

  // 任务保留，projectId 置空（schema onDelete: SetNull）
  await db.project.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
