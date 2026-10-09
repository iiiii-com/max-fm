import type { SessionUser } from "@/lib/auth";

/**
 * 普通版 / 专业版的唯一边界定义。
 *
 * 为什么要有这个文件：`users.plan` 字段本来就有，"Pro 会员" 徽标也早就在，
 * 但全站**只有那一处读它** —— 也就是说分层只存在于文案里，没有任何实际边界。
 * 政策三层解读（普通人视角 / 专业机构视角 / 趋势研判）全都在无差别免费展示，
 * 而专业机构视角那 40+ 条是带着传导路径和测算的真实内容。
 *
 * 划线原则（重要，别改错）：
 *   免费版不给"阉割的体验"，给的是**完整可用的结论**；专业版卖的是**更深的加工**。
 *   - 结论 vs 细节：免费给目标比例 / 景气分 / 分位，专业给矩阵、明细、窗口
 *   - 通俗 vs 专业：免费看普通人视角，专业看机构视角与趋势研判
 *   - 单点 vs 批量：免费单标的，专业做组合级批量（算力密集，这是真壁垒）
 * 藏页面、藏结论只会把人赶走；留下结论、只锁加工深度，才有转化压力。
 */

export type Plan = "free" | "pro";

export const PLAN_LABEL: Record<Plan, string> = { free: "普通版", pro: "专业版" };

/** 未登录一律按 free 处理（不因未登录给 extra 权限，也不因未登录报错） */
export function planOf(session: Pick<SessionUser, "plan"> | null | undefined): Plan {
  return session?.plan === "pro" ? "pro" : "free";
}

export function isPro(session: Pick<SessionUser, "plan"> | null | undefined): boolean {
  return planOf(session) === "pro";
}

export interface ProFeature {
  key: string;
  name: string;
  /** 内容分区（见 PRO_GROUP_ORDER） */
  group: ProGroup;
  /** 普通版能看到什么 —— 必须是真能用的结论，不能是"看不到" */
  free: string;
  /** 专业版多出什么 */
  pro: string;
  /** 落地模块 */
  modules: string[];
  /** 该能力是否已实现。未实现的要在界面上如实标"规划中"，不能列一个点不开的名字 */
  ready?: boolean;
}

/** 分区枚举要定义在 ProFeature 之前（interface 里用到） */
export const PRO_GROUP_ORDER = ["深度解读", "组合风控", "批量计算", "研究留档"] as const;
export type ProGroup = (typeof PRO_GROUP_ORDER)[number];

/**
 * 能力清单：既是 pricing 页的对比表，也是 API 门禁的注册表。
 * 加能力时在这里加一行，界面上就自动出现，不要另写一份文案。
 *
 * 什么能划进专业版、什么不能：
 *   能 —— 「更深的加工」：机构视角解读、协方差矩阵、组合级批量计算、导出。
 *   不能 —— 「结论的构成」。把景气分的三个因子、估值分位的统计区间藏起来，
 *          免费版就只剩一个无法核对的数字，这与站内「每个数字可追到来源」冲突；
 *          藏结论的构成不是壁垒，是把用户赶走。
 */
export const PRO_FEATURES: ProFeature[] = [
  {
    key: "policy-deep",
    name: "政策深度解读",
    group: "深度解读",
    free: "政策原文 + 普通人视角解读",
    pro: "专业机构视角（传导路径、量化测算、关注点）+ 趋势与风险研判，并可对未解读政策按需生成",
    modules: ["/policy"],
    ready: true,
  },
  {
    key: "portfolio-cov",
    name: "组合风险矩阵",
    group: "组合风控",
    free: "目标比例、TAA 偏离区间、各资产年化波动与样本窗口",
    pro: "相关矩阵、最小方差对照、等权/逆波动率/最小方差三种口径的波动率对比",
    modules: ["/advice"],
    ready: true,
  },
  {
    key: "batch-diagnosis",
    name: "自选股组合批量诊断",
    group: "组合风控",
    free: "单标的逐个查看",
    pro: "整组一次性诊断：组合年化波动、相关性最高的一对、集中度与有效标的数",
    modules: ["/account"],
    ready: true,
  },
  {
    key: "sector-rank",
    name: "行业景气排行",
    group: "批量计算",
    free: "单个板块的景气分（0–100）",
    pro: "多板块批量计算并横向排序：位置分位、20/60 日动量、年化波动并排对照",
    modules: ["/pro/sector-rank"],
    ready: true,
  },
  {
    key: "export",
    name: "研究结果导出",
    group: "研究留档",
    free: "页面内查看",
    pro: "配置比例、组合诊断、行业景气排行导出为 CSV 留档（含口径与样本区间）",
    modules: ["/pro/export"],
    ready: true,
  },
];

export const PRO_FEATURE_MAP: Record<string, ProFeature> = Object.fromEntries(
  PRO_FEATURES.map((f) => [f.key, f])
);

/**
 * 内容分区：专业版能力按「你在解决什么问题」分组，而不是按实现模块堆一列。
 * 顺序即展示顺序（pricing 与 /pro 中心页都用它）。
 */
/** 按分区聚合能力；空分区不返回 */
export function proFeaturesByGroup(): Array<{ group: ProGroup; items: ProFeature[] }> {
  return PRO_GROUP_ORDER.map((group) => ({
    group,
    items: PRO_FEATURES.filter((f) => f.group === group),
  })).filter((g) => g.items.length > 0);
}

/* ------------------------------------------------------------------ *
 * 管理员：谁能开通专业版
 * ------------------------------------------------------------------ */

/**
 * 管理员白名单（`ADMIN_EMAILS`，逗号分隔）。
 *
 * 三条刻意的设计：
 *  1) **fail closed** —— 环境变量没配 = 没有任何人是管理员。绝不默认放行，
 *     也不因为"本地开发"就开个后门：这类开关最容易在部署时被忘掉然后裸奔。
 *  2) 只比邮箱且大小写不敏感（注册时邮箱已归一化），不接受用户可控的 id/name。
 *  3) 开通动作本身要留痕：调用方负责写 task_logs，见 /api/admin/plan。
 */
export function isAdmin(session: Pick<SessionUser, "email"> | null | undefined): boolean {
  if (!session?.email) return false;
  const raw = process.env.ADMIN_EMAILS;
  if (!raw || !raw.trim()) return false;
  const allow = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return allow.includes(session.email.trim().toLowerCase());
}

/** 管理员接口的统一门禁：未登录 401，非管理员 403（与 proGate 的 402 区分开） */
export function adminGate(
  session: Pick<SessionUser, "email"> | null | undefined
): { status: number; body: Record<string, unknown> } | null {
  if (!session) return { status: 401, body: { ok: false, error: "请先登录" } };
  if (!isAdmin(session)) return { status: 403, body: { ok: false, error: "需要管理员权限" } };
  return null;
}

/**
 * API 门禁判定：非专业版返回 `{ status: 402, body }`，专业版返回 null。
 *
 * 刻意返回**普通对象**而不是 NextResponse：付费边界是全站最不能出错的一段逻辑，
 * 绑死在 next/server 上就没法用纯 Node 跑断言（next/server 在 node 直跑时解析不了）。
 * 路由层负责把它包成响应，一行：`if (g) return NextResponse.json(g.body, { status: g.status })`。
 *
 * 用 402 而不是 403：403 的语义是"你没权限"，402 的语义是"这需要付费"。
 * 前端据此决定是显示升级引导还是报错，两者不能混。
 */
export function proGate(
  session: Pick<SessionUser, "plan"> | null | undefined,
  featureKey: string
): { status: number; body: Record<string, unknown> } | null {
  if (isPro(session)) return null;
  const f = PRO_FEATURE_MAP[featureKey];
  return {
    status: 402,
    body: {
      ok: false,
      needPro: true,
      feature: featureKey,
      error: f ? `${f.name}属于专业版能力` : "该能力属于专业版",
      freeTier: f?.free ?? null,
      proTier: f?.pro ?? null,
    },
  };
}

/**
 * 数据降级：同一份完整结果，按版本裁掉明细。
 * 返回 { data, locked }，locked 列出被裁掉的字段名，供前端显示"专业版可见"而不是空白。
 */
export function maskForPro<T extends Record<string, any>>(
  session: Pick<SessionUser, "plan"> | null | undefined,
  full: T,
  proOnlyKeys: string[]
): { data: T; locked: string[] } {
  if (isPro(session)) return { data: full, locked: [] };
  const data: Record<string, any> = { ...full };
  const locked: string[] = [];
  for (const k of proOnlyKeys) {
    if (k in data && data[k] != null) {
      locked.push(k);
      delete data[k];
    }
  }
  return { data: data as T, locked };
}