import { nodeDetail } from "@/lib/data/chainNodeDetailsAll";
import { safeJsonArray } from "@/lib/utils";
import ChainQuotes from "@/components/industry/ChainQuotes";

/**
 * 环节展开区：结构化维度 + 相关标的行情。
 *
 * 泳道的 summary 里已放环节讲解（默认可见），这里只放能对照比较的字段：
 * 做什么 / 赚什么钱 / 为什么进不来 / 看什么指标 / 什么风险。
 * 这套维度是"产业地图不像示意图"的关键 —— 示意图只给结构，
 * 这里给判断依据。
 *
 * 数据纪律：指标只列名称，不列数值。数值由 chain_metrics 表在满足
 * 「单位 + 时点 + 来源 + 口径」四件套校验后才展示（见泳道底部 MetricStrip），
 * 两处数字必须只有一个来源。
 */
export default function ChainNodeDetailPanel({
  slug,
  nodeName,
  companies,
  description,
}: {
  slug: string;
  nodeName: string;
  companies?: string | null;
  description?: string | null;
}) {
  const d = nodeDetail(slug, nodeName);
  const list = safeJsonArray<string>(companies);

  const rows: Array<{ label: string; value: string }> = d
    ? [
        { label: "做什么", value: d.products },
        { label: "赚什么钱", value: d.value },
        { label: "为什么进不来", value: d.barriers },
      ]
    : [];

  return (
    <div className="min-w-0 space-y-2.5">
      {rows.length > 0 && (
        <dl className="space-y-1.5">
          {rows.map((r) => (
            <div key={r.label} className="flex gap-2">
              <dt className="shrink-0 text-[11px] font-semibold text-muted w-16 pt-px">
                {r.label}
              </dt>
              <dd className="min-w-0 text-[12px] leading-relaxed text-foreground/80">
                {r.value}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {d && d.metrics.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-muted mb-1">看什么指标</p>
          <ul className="flex flex-wrap gap-1.5">
            {d.metrics.map((m) => (
              <li
                key={m}
                className="px-1.5 py-0.5 rounded text-[11px] bg-primary/10 text-primary"
              >
                {m}
              </li>
            ))}
          </ul>
          <p className="mt-1 text-[10px] leading-relaxed text-muted/80">
            只列指标名称，不列数值 —— 数值需通过「单位 + 时点 + 来源 + 口径」校验后才展示。
          </p>
        </div>
      )}

      {d && d.risks.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-muted mb-1">这个环节可能怎么出问题</p>
          <ul className="space-y-1">
            {d.risks.map((r) => (
              <li key={r} className="flex gap-1.5 text-[12px] leading-relaxed text-muted">
                <span className="text-red-500 shrink-0">·</span>
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 结构化维度缺失时要说明，而不是留白 —— 否则读者会以为这个环节没有分析 */}
      {!d && (
        <p className="text-[11px] italic leading-relaxed text-muted">
          该环节尚未补齐结构化维度（做什么 / 利润归属 / 壁垒 / 指标 / 风险）。
          {description ? "上方讲解为现有内容。" : ""}
        </p>
      )}

      {list.length > 0 && (
        <div className="pt-1">
          <ChainQuotes companies={list} />
        </div>
      )}
    </div>
  );
}