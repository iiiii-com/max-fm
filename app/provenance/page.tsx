import Link from "next/link";
import { bootstrap } from "@/lib/db";
import { Card, Badge, SectionTitle, StatCard } from "@/components/ui";
import { fmtDateTime } from "@/lib/utils";
import { getProvenanceReport, PROVENANCE_GROUPS } from "@/lib/data/provenance";
import {
  KIND_LABEL,
  STATUS_LABEL,
  STATUS_TONE,
  needsAttention,
  type ProvenanceStatus,
} from "@/lib/data/provenance-logic";
import RefreshButton from "@/components/provenance/RefreshButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "数据溯源" };

const STATUS_ORDER: ProvenanceStatus[] = ["live", "stream", "delayed", "stale", "seed", "down"];

function groupHref(group?: string, status?: string) {
  const params = new URLSearchParams();
  if (group && group !== "全部") params.set("group", group);
  if (status && status !== "全部") params.set("status", status);
  const qs = params.toString();
  return `/provenance${qs ? `?${qs}` : ""}`;
}

/**
 * 数据溯源台。
 *
 * 这个页面回答的是一个很具体的问题：**我现在看到的这个数字，能不能信、有多新、从哪来**。
 * 所以版面按「先给结论（概览数字）→ 再给需要处理的问题 → 最后才是完整清单」排，
 * 而不是一上来就摆 25 张卡片。
 */
export default async function ProvenancePage({
  searchParams,
}: {
  searchParams: Promise<{ group?: string; status?: string }>;
}) {
  const { group, status } = await searchParams;
  await bootstrap();
  const report = await getProvenanceReport();

  const activeGroup = group && PROVENANCE_GROUPS.includes(group as any) ? group : "全部";
  const activeStatus = STATUS_ORDER.includes(status as ProvenanceStatus) ? (status as ProvenanceStatus) : "全部";

  const filtered = report.items.filter((item) => {
    if (activeGroup !== "全部" && item.group !== activeGroup) return false;
    if (activeStatus !== "全部" && item.status !== activeStatus) return false;
    return true;
  });

  const attention = report.items.filter((item) => needsAttention(item.status));
  const fresh = report.summary.live + report.summary.stream;
  const genTime = fmtDateTime(report.generatedAt);

  return (
    <div className="mx-auto max-w-7xl px-3 sm:px-4 py-5 sm:py-6 space-y-6">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">数据溯源</h1>
          <p className="text-sm text-muted mt-1 leading-relaxed">
            每个数字都要能回答三件事：<span className="text-text">从哪来</span>、<span className="text-text">什么时候更新</span>、<span className="text-text">现在还可不可信</span>。
            这份清单按「行数 + 最近更新时间 + 更新节奏」自动判定状态，覆盖全站 {report.summary.total} 个数据集。
          </p>
          <p className="text-[11px] text-muted/80 mt-1.5 flex items-center gap-2 flex-wrap">
            <span>采集于 {genTime}</span>
            <span className="text-muted/60">·</span>
            <Link href="/api/provenance" className="hover:text-primary underline-offset-2 hover:underline">
              机器可读 JSON
            </Link>
            <span className="text-muted/60">· 加 ?fresh=1 跳过 60 秒缓存</span>
          </p>
        </div>
        <RefreshButton />
      </header>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="数据集" value={String(report.summary.total)} sub={`覆盖 ${PROVENANCE_GROUPS.length} 个板块`} />
        <StatCard
          label="新鲜 / 实时"
          value={String(fresh)}
          sub={`${report.summary.live} 个落库 · ${report.summary.stream} 个实时接口`}
        />
        <StatCard
          label="需关注"
          value={String(report.summary.problems)}
          sub={`陈旧 ${report.summary.stale} · 示例 ${report.summary.seed} · 不可用 ${report.summary.down}`}
        />
        <StatCard
          label="延迟"
          value={String(report.summary.delayed)}
          sub="慢于预期节奏，但还没到陈旧"
        />
      </section>

      {report.notes.length > 0 && (
        <Card className="border-accent/40 bg-accent-soft/40">
          <h2 className="font-bold text-sm mb-2">采集备注</h2>
          <ul className="space-y-1.5 text-sm text-muted">
            {report.notes.map((note, index) => (
              <li key={index} className="flex gap-2">
                <span className="text-accent shrink-0">·</span>
                <span>{note}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {report.nextActions.length > 0 && (
        <Card>
          <h2 className="font-bold text-sm mb-2">建议优先处理（{attention.length} 项需要关注）</h2>
          <ol className="space-y-1.5 text-sm text-muted list-decimal list-inside">
            {report.nextActions.map((action, index) => (
              <li key={index}>{action}</li>
            ))}
          </ol>
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        {(["全部", ...PROVENANCE_GROUPS] as string[]).map((g) => (
          <Link
            key={g}
            href={groupHref(g, activeStatus)}
            aria-current={activeGroup === g ? "page" : undefined}
            className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
              activeGroup === g ? "bg-primary text-white border-primary" : "border-border hover:border-primary/50"
            }`}
          >
            {g}
          </Link>
        ))}
        <span className="w-px bg-border mx-1" aria-hidden />
        {(["全部", ...STATUS_ORDER] as string[]).map((st) => {
          const label = st === "全部" ? "全部状态" : STATUS_LABEL[st as ProvenanceStatus];
          return (
            <Link
              key={st}
              href={groupHref(activeGroup, st)}
              aria-current={activeStatus === st ? "page" : undefined}
              className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                activeStatus === st ? "bg-primary text-white border-primary" : "border-border hover:border-primary/50"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </div>

      {filtered.length === 0 && <Card className="p-8 text-center text-sm text-muted">该筛选下没有数据集</Card>}

      {PROVENANCE_GROUPS.map((g) => {
        const groupItems = filtered.filter((item) => item.group === g);
        if (groupItems.length === 0) return null;
        return (
          <section key={g}>
            <SectionTitle
              title={g}
              sub={`${groupItems.length} 个数据集 · ${groupItems.filter((i) => needsAttention(i.status)).length} 个需关注`}
            />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {groupItems.map((item) => (
                <div key={item.id} id={item.id} className="scroll-mt-20">
                <Card className="flex flex-col h-full">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <h3 className="font-bold text-base leading-snug">{item.name}</h3>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Badge tone={STATUS_TONE[item.status]}>{STATUS_LABEL[item.status]}</Badge>
                      <Badge tone="gray">{KIND_LABEL[item.kind]}</Badge>
                      {item.optional && <Badge tone="cyan">非关键</Badge>}
                    </div>
                  </div>

                  <p className="text-xs text-muted mt-2 font-mono flex items-center gap-2 flex-wrap">
                    <span>{item.cadence}</span>
                    <span className="text-muted/50">·</span>
                    <span>{item.rows === null ? "行数 —" : `${item.rows.toLocaleString("zh-CN")} 行`}</span>
                    <span className="text-muted/50">·</span>
                    <span>{item.lastUpdated === null ? "更新时间 —" : `${fmtDateTime(item.lastUpdated)}（${item.ageText}）`}</span>
                  </p>

                  <p className="text-sm text-muted mt-2 leading-relaxed">{item.note}</p>

                  {item.risk && (
                    <p className="text-[13px] text-muted mt-2 leading-relaxed">
                      <span className="text-accent font-medium">失真风险：</span>
                      {item.risk}
                    </p>
                  )}

                  {item.issue && (
                    <p className="text-[13px] mt-2 leading-relaxed text-primary">
                      <span className="font-medium">当前状态：</span>
                      {item.issue}
                    </p>
                  )}

                  <div className="mt-auto pt-2.5 border-t border-border/60 flex items-center justify-between gap-2 text-[11px] text-muted">
                    <span className="truncate" title={item.storage}>
                      {item.storage ?? item.group}
                    </span>
                    {item.api?.startsWith("/api") ? (
                      <Link href={item.api} className="font-mono hover:text-primary underline-offset-2 hover:underline shrink-0">
                        {item.api}
                      </Link>
                    ) : (
                      <span className="font-mono shrink-0">{item.api ?? "—"}</span>
                    )}
                  </div>
                </Card>
                </div>
              ))}
            </div>
          </section>
        );
      })}

      <section>
        <SectionTitle title="最近任务记录" sub="每个数据集由哪个定时任务维护、上次成功/失败时间" />
        <Card className="overflow-x-auto">
          {report.tasks.length === 0 ? (
            <p className="text-sm text-muted">暂无任务日志（或数据库不可用）。</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted border-b border-border">
                  <th className="py-2 pr-3 font-medium">任务</th>
                  <th className="py-2 pr-3 font-medium">结果</th>
                  <th className="py-2 pr-3 font-medium">最近一次</th>
                  <th className="py-2 font-medium">耗时</th>
                </tr>
              </thead>
              <tbody>
                {report.tasks.map((task) => (
                  <tr key={task.name} className="border-b border-border/40 last:border-0">
                    <td className="py-2 pr-3 font-mono text-[13px]">{task.name}</td>
                    <td className="py-2 pr-3">
                      <Badge tone={task.status === "failed" ? "red" : task.status === "success" ? "green" : "gray"}>
                        {task.status || "未知"}
                      </Badge>
                    </td>
                    <td className="py-2 pr-3 text-muted">{task.at === null ? "—" : `${fmtDateTime(task.at)}（${task.ageText}）`}</td>
                    <td className="py-2 text-muted font-mono">
                      {task.durationMs === null ? "—" : `${(task.durationMs / 1000).toFixed(1)}s`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </section>

      <section>
        <SectionTitle title="怎么用这条通道" sub="三种查法：页面、接口、以及接口响应头" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Card>
            <h3 className="font-bold text-sm mb-1.5">① 页面</h3>
            <p className="text-sm text-muted leading-relaxed">
              就是本页。每个数据集一张卡：来源、行数、最近更新时间、失真风险、由哪个任务维护。
              点卡片右上角的接入点可以直接复核原始数据。
            </p>
          </Card>
          <Card>
            <h3 className="font-bold text-sm mb-1.5">② 接口</h3>
            <p className="text-sm text-muted leading-relaxed font-mono text-[13px] break-all">
              GET /api/provenance
              <br />
              GET /api/provenance?fresh=1
            </p>
            <p className="text-xs text-muted mt-1.5">
              返回同一份清单（含 summary），适合做外部巡检或数据门禁。
            </p>
          </Card>
          <Card>
            <h3 className="font-bold text-sm mb-1.5">③ 响应头</h3>
            <p className="text-sm text-muted leading-relaxed">
              K 线等接口会带 <span className="font-mono text-[13px]">X-Data-Dataset</span> /
              <span className="font-mono text-[13px]"> X-Data-Trace</span>，把响应与这里的某一行对应起来；
              快照兜底时看 <span className="font-mono text-[13px]">X-Cache: STALE</span>。
            </p>
          </Card>
        </div>
      </section>

      <p className="text-xs text-muted leading-relaxed">
        判定口径：新鲜 = 在一个更新周期内；延迟 = 超过常规节奏但未满一个完整周期；陈旧 = 超过一个以上周期没更新；
        示例数据 = 库里是种子序列而非真实来源；不可用 = 空表、查询失败或上游停更。
        规则写死在 <span className="font-mono">lib/data/provenance-logic.ts</span> 并由单测覆盖，不会随页面改版漂移。
      </p>
    </div>
  );
}
