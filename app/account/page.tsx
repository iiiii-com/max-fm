import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession, getUserFromDb } from "@/lib/auth";
import { getUserAdvice, getUserFeelings, getWatchlist } from "@/lib/data/queries";
import { Badge, Card, SectionTitle } from "@/components/ui";
import { fmtDateTime } from "@/lib/utils";
import { bootstrap } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "个人中心" };

export default async function AccountPage() {
  await bootstrap();
  const session = await getSession();
  if (!session) redirect("/login");
  const [user, advice, feelings, watch] = await Promise.all([
    getUserFromDb(session.id),
    getUserAdvice(session.id),
    getUserFeelings(session.id),
    getWatchlist(session.id),
  ]);

  const riskLabel: Record<string, string> = { low: "稳健型", medium: "平衡型", high: "进取型" };
  // 旧实现走 toISOString()，把原始 ISO 串直接丢进页面（`2026-09-28T04:45:35.295Z`）；现统一格式化
  const fmtTs = (ts?: number | null) => fmtDateTime(ts);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold">个人中心</h1>
      </header>

      <Card className="flex flex-wrap items-center gap-4 p-6">
        <div className="flex items-center justify-center w-14 h-14 rounded-full bg-primary text-white font-bold text-xl">
          {(session.name || "用").slice(0, 1)}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-bold text-lg">{session.name}</h2>
            {/* 风险测评状态：已完成才显示风险等级，否则显示「未完成」——旧实现把兜底文案当成了徽标 */}
            {user?.riskLevel ? (
              <Badge>{riskLabel[user.riskLevel] ?? user.riskLevel}</Badge>
            ) : (
              <Badge tone="gray">未做风险测评</Badge>
            )}
            <Badge>{session.plan === "pro" ? "Pro 会员" : "免费用户"}</Badge>
          </div>
          <p className="text-sm text-muted mt-0.5 break-all">{session.email}</p>
          <p className="text-xs text-muted mt-1">注册时间：{fmtTs(user?.createdAt)}</p>
        </div>
        <form action="/api/auth/logout" method="POST" className="ml-auto">
          <button type="submit" className="px-4 py-1 rounded-lg border border-border text-sm hover:border-red-400 hover:text-red-600 transition-colors">
            退出登录
          </button>
        </form>
      </Card>

      <section>
        <SectionTitle title="我的 AI 建议" sub={`共 ${advice.length} 份`} />
        {advice.length ? (
          <div className="space-y-3">
            {advice.slice(0, 8).map((a: any) => (
              <Card key={a.id} className="p-4">
                <div className="flex items-baseline gap-2 mb-1 flex-wrap">
                  <span className="font-medium">{a.riskLevel ? `${a.riskLevel} · 投资建议` : "投资建议"}</span>
                  <span className="text-xs text-muted ml-auto">{fmtTs(a.createdAt)}</span>
                </div>
                <p className="text-sm text-muted line-clamp-1">
                  {a.temperatureDiff != null
                    ? `温差参考 ${Number(a.temperatureDiff) > 0 ? "+" : ""}${Math.round(Number(a.temperatureDiff))}°`
                    : "生成时无体感问卷数据，无温差参考"}
                </p>
                <Link href="/advice" className="text-xs text-primary hover:underline mt-1 inline-block">查看完整报告 →</Link>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-4 text-sm text-muted">
            还没有生成过建议，去{" "}
            <Link href="/advice" className="text-primary underline">个人建议</Link>{" "}
            完成测评，让 AI 为你生成第一份投资建议。
          </Card>
        )}
      </section>

      <section>
        <SectionTitle title="体感记录" sub={`共 ${feelings.length} 次`} />
        {feelings.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted border-b border-border">
                  <th className="py-2 pr-4 font-medium">时间</th>
                  <th className="py-2 pr-4 font-medium">体感分</th>
                  <th className="py-2 pr-4 font-medium">年龄段</th>
                  <th className="py-2 font-medium">地区</th>
                </tr>
              </thead>
              <tbody>
                {feelings.slice(0, 20).map((f: any) => (
                  <tr key={f.id} className="border-b border-border/50">
                    <td className="py-2 pr-4">{fmtTs(f.createdAt)}</td>
                    <td className="py-2 pr-4">
                      <span className={`font-mono font-medium ${f.score >= 50 ? "up" : "down"}`}>{f.score}</span>
                    </td>
                    <td className="py-2 pr-4">{f.ageGroup || "—"}</td>
                    <td className="py-2">{f.region || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Card className="p-4 text-sm text-muted">
            还没有提交过体感问卷，去{" "}
            <Link href="/macro/feeling" className="text-primary underline">宏观温度</Link>{" "}
            对比一下你的感受与宏观数据的差异。
          </Card>
        )}
      </section>

      <section>
        <SectionTitle title="我的自选" sub={`${watch.length} 个标的`} />
        {watch.length ? (
          <div className="flex flex-wrap gap-2">
            {watch.map((w: any) => (
              <span key={w.id} className="px-3 py-1.5 rounded-lg border border-border text-sm bg-card">
                {w.name} <span className="text-xs text-muted font-mono ml-1">{w.code}</span>
              </span>
            ))}
          </div>
        ) : (
          <Card className="p-4 text-sm text-muted">
            {/* 旧文案指向并不存在的「投资分析」页；改为指向真实存在的两个入口，并统一按钮叫法 */}
            在 <Link href="/stock" className="text-primary underline">个股行情</Link> 或{" "}
            <Link href="/etf" className="text-primary underline">ETF 专区</Link>{" "}
            页点击「☆ 加自选」即可收藏标的；板块可在{" "}
            <Link href="/sector" className="text-primary underline">板块中心</Link> 收藏。
          </Card>
        )}
      </section>
    </div>
  );
}
