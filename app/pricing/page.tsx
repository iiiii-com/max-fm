import Link from "next/link";
import { ArrowLeft, Check, Lock } from "lucide-react";
import { Card } from "@/components/ui";
import { getSession } from "@/lib/auth";
import { isPro, PRO_FEATURES, PLAN_LABEL, proFeaturesByGroup } from "@/lib/plan";

export const dynamic = "force-dynamic";
export const metadata = { title: "普通版与专业版 | Max 财经" };

/**
 * 版本对比页。
 *
 * 这张表**直接由 lib/plan.ts 的能力注册表生成**，不另写一份文案 ——
 * 否则功能改了、文案没改，就会出现"写着的功能不存在 / 存在的功能没写"，
 * 那是拿用户当傻子，也是所有付费页最容易烂掉的地方。
 *
 * 划线原则写在 plan.ts 里，这里只负责如实呈现：
 * 普通版给完整可用的结论，专业版给更深的加工（矩阵、机构视角、批量、导出）。
 */
export default async function PricingPage() {
  const session = await getSession();
  const pro = isPro(session);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 space-y-8">
      <header>
        <div className="flex items-center gap-2 text-xs text-muted mb-3">
          <Link href="/" className="hover:text-primary">首页</Link>
          <span>/</span>
          <span className="text-foreground font-medium">版本与能力</span>
        </div>
        <h1 className="font-black text-2xl sm:text-3xl tracking-tight mb-3">
          普通版与专业版
        </h1>
        <p className="text-sm text-muted leading-relaxed max-w-3xl">
          划线的唯一依据是<b className="text-foreground">加工深度</b>，不是功能开关。
          普通版拿到的是<b className="text-foreground">完整可用的结论</b>；
          专业版卖的是矩阵、机构视角、批量计算与导出这类<b className="text-foreground">更深的加工</b>。
          我们不做「把结论锁起来逼你付费」——那只会让人转身走掉，
          而且一个看不到来源的数字，对做研究的人本来也没有价值。
        </p>
        {session ? (
          <p className="text-xs text-muted mt-3">
            你当前是 <b className="text-foreground">{PLAN_LABEL[pro ? "pro" : "free"]}</b>
            {pro ? "，下表能力已全部可用。" : "。"}
          </p>
        ) : (
          <p className="text-xs text-muted mt-3">
            未登录：<Link href="/login" className="text-primary hover:underline">登录</Link> 后可查看账号当前的版本。
          </p>
        )}
      </header>

      {/* 能力对比：按分区组织，普通版每格都必须写清"能看到什么"，不能写"不可用" */}
      <section className="space-y-6">
        {proFeaturesByGroup().map((g) => (
          <div key={g.group}>
            <div className="flex items-baseline gap-2 mb-2">
              <h2 className="font-bold text-base tracking-tight">{g.group}</h2>
              <span className="text-[10px] text-muted">{g.items.length} 项</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[680px]">
                <thead>
                  <tr className="text-xs text-muted border-b border-border">
                    <th className="text-left py-2.5 pl-2 pr-3 font-medium w-40">能力</th>
                    <th className="text-left px-3 py-2.5 font-medium">普通版</th>
                    <th className="text-left px-3 py-2.5 font-medium bg-primary/4">专业版</th>
                  </tr>
                </thead>
                <tbody>
                  {g.items.map((f) => (
                    <tr key={f.key} className="border-b border-border/50 align-top">
                      <td className="py-3 pl-2 pr-3">
                        <span className="font-semibold">{f.name}</span>
                        {!f.ready && (
                          <span className="ml-1.5 text-[10px] text-muted border border-border rounded px-1 py-0.5">
                            规划中
                          </span>
                        )}
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {f.modules.map((m) => (
                            <Link
                              key={m}
                              href={m}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-primary/8 text-primary border border-primary/20 hover:bg-primary/15"
                            >
                              {m}
                            </Link>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-xs text-muted leading-relaxed">
                        <span className="inline-flex items-start gap-1.5">
                          <Check className="w-3.5 h-3.5 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
                          {f.free}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-xs leading-relaxed bg-primary/4">
                        <span className="inline-flex items-start gap-1.5">
                          <Lock className="w-3.5 h-3.5 shrink-0 mt-0.5 text-primary" />
                          <span className="text-foreground/85">{f.pro}</span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="p-5">
          <p className="text-xs font-black px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 inline-block mb-2">
            {PLAN_LABEL.free}
          </p>
          <p className="text-sm font-semibold mb-2">研究体系的完整骨架</p>
          <ul className="text-xs text-muted leading-relaxed space-y-1.5">
            <li>· 十二学院框架与十一环节决策链全文</li>
            <li>· 全球指数行情与全历史 K 线</li>
            <li>· 40 条产业链结构与环节讲解</li>
            <li>· 政策原文与普通人视角解读</li>
            <li>· 单标的估值分位、景气分、风险指标</li>
            <li>· 全部结论的来源口径与样本窗口</li>
          </ul>
        </Card>

        <Card className="p-5 border-primary/30 bg-primary/4">
          <p className="text-xs font-black px-2 py-0.5 rounded bg-primary text-white inline-block mb-2">
            {PLAN_LABEL.pro}
          </p>
          <p className="text-sm font-semibold mb-2">在结论之上做更深的加工</p>
          <ul className="text-xs text-muted leading-relaxed space-y-1.5">
            {PRO_FEATURES.map((f) => (
              <li key={f.key}>· {f.pro}</li>
            ))}
          </ul>
        </Card>

        <Card className="p-5">
          <p className="text-sm font-bold mb-2">怎么开通</p>
          <p className="text-xs text-muted leading-relaxed">
            专业版尚未开放自助购买。当前<code className="mx-1 px-1 rounded bg-border/50 text-[10px]">users.plan</code>
            字段已就绪（<code className="mx-1 px-1 rounded bg-border/50 text-[10px]">free</code> /
            <code className="mx-1 px-1 rounded bg-border/50 text-[10px]">pro</code>），
            权限每次从库里读、不写进令牌，因此开通后下一次请求立即生效，无需重新登录。
          </p>
          <p className="text-xs text-muted leading-relaxed mt-3">
            需要开通请联系站点管理员。我们不展示「限时优惠」这类
            <b className="text-foreground">与产品能力无关</b>的压力话术。
          </p>
        </Card>
      </section>

      <div className="flex items-center justify-between border-t border-border pt-4">
        <Link href="/gmrds" className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-primary">
          <ArrowLeft className="w-3.5 h-3.5" /> 去看研究体系
        </Link>
        <p className="text-[10px] text-muted">能力边界定义在 lib/plan.ts，本页表格由其自动生成</p>
      </div>
    </div>
  );
}