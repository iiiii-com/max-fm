import { NextResponse } from "next/server";

/**
 * 统一的 JSON 错误响应。
 *
 * 背景（2026-10-31 线上事故）：`/api/auth/register` 原先没有任何 try/catch，
 * 生产库（Neon）配额超限时 `db.insert()` 直接抛异常，Next 在 production 下
 * 会返回 **空响应体的 500**；浏览器端 `await res.json()` 于是抛
 * `Failed to execute 'json' on 'Response': Unexpected end of JSON input`，
 * 用户看到的是这句前端报错，而不是「服务暂不可用」，完全无法判断该做什么。
 *
 * 约束：认证类接口无论成功失败都必须返回 JSON —— 前端据此展示可读文案。
 */
export function apiError(status: number, error: string, headers: Record<string, string> = {}) {
  return NextResponse.json({ ok: false, error }, { status, headers });
}

/** 常见的基础设施故障文案：库连不上 / 配额超限 / 只读降级。 */
const INFRA_HINT =
  /exceeded the quota|quota|too many connections|too many clients|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|ECONNRESET|EAI_AGAIN|terminating connection|password authentication failed|no pg_hba.conf|timeout expired/i;

/**
 * 把认证/账号接口的未捕获异常转成用户能看懂、且一定带 JSON body 的响应。
 * - 基础设施类（数据库配额/连接）→ 503，文案说明是服务端问题而非用户输入错误
 * - 其它未预期异常 → 500，日志里留完整堆栈，响应里不泄露细节
 */
export function guardAuthFailure(scope: string, err: unknown) {
  const raw = (err as any)?.message ?? err;
  const message = String(raw ?? "");
  const infra = INFRA_HINT.test(message);

  if (infra) {
    // 数据库类故障不需要每次刷堆栈，留一行足够定位
    console.warn(`[${scope}] 数据库不可用：${message.split("\n")[0].slice(0, 200)}`);
    return apiError(
      503,
      "数据服务暂时不可用（数据库连接或配额异常），账号相关操作暂时无法完成，请稍后重试。"
    );
  }

  console.error(`[${scope}] 未处理异常：`, err);
  return apiError(500, "服务暂时不可用，请稍后重试。");
}
