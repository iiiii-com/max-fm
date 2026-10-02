import { LEVELS, levelOrder, isRealLevel } from "@/lib/data/chainLevels";
import { safeJsonArray } from "@/lib/utils";
import { formatMetric, metricAsOfYear, type ValidMetric } from "@/lib/data/chainMetrics";

/**
 * 产业链分层泳道 —— 方向 A 的实现。
 *
 * 替换掉原来的 SVG 弧形布线图（ChainSchematic，307 行）。动机不只是审美：
 *
 * 1. 那个图画了 9 条带箭头的连线，但没有一条边有真实数据 —— 全是按层级推断的。
 *    视觉上它在断言「中游供给消费电子」这类并不存在的供给关系。
 *    泳道不画边，方向只在图注里用一句话陈述，删掉了全部虚假断言。
 *
 * 2. SVG 的 `role="img"` 会让内部的 9 个 `role="button"` 对屏幕阅读器全部隐身；
 *    `sm:(640px)` 与 `max-width:767px` 两套断点打架；`min-w-[700px]` 在 640–767px
 *    区间失效。全部改用 HTML 后这三类问题一并消失，且文字随系统字号缩放。
 *
 * 3. 节点是排版条目而不是圆角卡片 —— 不画边框、不加阴影、不做 hover 浮起。
 *    整张图唯一的"容器"是层间那条发丝线。
 *
 * 4. 颜色全部让给涨跌语义。层级靠位置 + 文字表意，不用色块区分 ——
 *    此前 `ChainFlow.tsx` 把「中游」映射成涨跌红，结构字段占用了语义色通道。
 */

export interface SwimNode {
  id: string;
  name: string;
  level?: string | null;
  companies?: string | null;
  description?: string | null;
}

export interface SwimBand {
  role: string;
  nodes: SwimNode[];
}

/** 单个节点：名称 + 代表公司。没有卡片框，靠排版建立层级。 */
function NodeEntry({ node, detail }: { node: SwimNode; detail?: (n: SwimNode) => React.ReactNode }) {
  const companies = safeJsonArray<string>(node.companies);
  if (!detail) {
    return (
      <li className="min-w-0">
        <p className="text-sm font-medium leading-snug">{node.name}</p>
        {companies.length ? (
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted">{companies.join(" · ")}</p>
        ) : (
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted italic">未细分到具体标的</p>
        )}
      </li>
    );
  }
  // 详情页模式：节点本身即展开器，避免同一批环节在页面上出现两遍
  // （此前泳道一份、卡片网格一份，信息完全重复）
  //
  // 环节讲解放在 summary 里而不是展开区 —— 此前 173 条环节解读全藏在
  // <details> 内部，读者不逐个点开就等于没写。默认可见是这个内容
  // 能不能被读到的关键；展开区留给结构化维度（产品/利润/壁垒/指标/风险）。
  return (
    <li className="min-w-0">
      <details className="group">
        <summary className="cursor-pointer marker:content-[''] list-none">
          <span className="text-sm font-medium leading-snug group-open:underline underline-offset-4">
            {node.name}
          </span>
          {companies.length ? (
            <p className="mt-0.5 text-[11px] leading-relaxed text-muted">{companies.join(" · ")}</p>
          ) : null}
          {node.description ? (
            <p className="mt-1.5 text-[12px] leading-relaxed text-foreground/75">
              {node.description}
            </p>
          ) : null}
        </summary>
        <div className="mt-2 border-t border-border pt-2">{detail(node)}</div>
      </details>
    </li>
  );
}

/** 单层带：表头（层级 + 右对齐计数）+ 节点网格 + 设计过的空态 */
function Band({
  role,
  nodes,
  detail,
}: {
  role: string;
  nodes: SwimNode[];
  detail?: (n: SwimNode) => React.ReactNode;
}) {
  return (
    <section className="py-4 first:pt-0" aria-label={`${role}环节`}>
      <header className="mb-3 flex items-baseline gap-3">
        <h3 className="text-sm font-bold tracking-wide">{role}</h3>
        <span className="text-[11px] text-muted tabular-nums">{nodes.length} 环节</span>
        <span className="h-px flex-1 bg-border" aria-hidden />
      </header>
      {nodes.length ? (
        <ul className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          {nodes.map((n) => (
            <NodeEntry key={n.id} node={n} detail={detail} />
          ))}
        </ul>
      ) : (
        <p className="text-xs italic text-muted">该链未划分到{role}环节</p>
      )}
    </section>
  );
}

/**
 * 链级已核验指标。
 *
 * 视觉上刻意做得比结构性内容更弱：更小字号、更低对比、方括号包裹。
 * 理由是**注释是注释，不是标题** —— 环节结构是这张图的主体，数字是旁注。
 *
 * 零指标时同样要出现：否则"这条链一个可信数字都没有"这件事会被静默隐藏，
 * 读者只会以为页面上没这回事。诚实的空态必须被设计出来，而不是留白。
 */
function MetricStrip({ metrics }: { metrics: ValidMetric[] }) {
  if (!metrics.length) {
    return (
      <div className="mt-4 border-t border-border pt-3">
        <p className="text-[11px] text-muted">
          暂无可核验的量化指标：这条链的规模与增速多来自券商测算或企业白皮书，
          缺乏统一官方口径，因此不展示 —— 留空优于展示一个无法核验的数字。
        </p>
      </div>
    );
  }
  return (
    <div className="mt-4 border-t border-border pt-3">
      <p className="text-[11px] text-muted mb-2">已核验指标（括号内为统计时点，悬停可见来源与口径）</p>
      <ul className="flex flex-wrap gap-x-5 gap-y-1.5">
        {metrics.map((m) => (
          <li key={`${m.slug}-${m.key}`}>
            <span className="text-[11px] text-muted">{m.name}</span>
            <span className="ml-1.5 text-[11px] font-mono tabular-nums text-muted/90">
              〔{formatMetric(m)} · {metricAsOfYear(m)}〕
            </span>
            <span className="sr-only">
              来源：{m.source}；口径：{m.caliber}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[11px] leading-relaxed text-muted">
        未列出的指标表示暂无可核验的公开口径，刻意留空而非填入估算值。
      </p>
    </div>
  );
}

/**
 * @param nodes 可传全部节点（含跨链关联），内部会按 LEVELS 过滤并排序
 * @param bands 也可由调用方直接给定分组（详情页已有分组结果，避免重复计算）
 * @param detail 提供后每个节点变为可展开，展开区由调用方渲染（详情页模式）
 * @param metrics 已通过四件套校验的链级指标
 */
export default function ChainSwimlane({
  nodes,
  bands,
  detail,
  metrics = [],
}: {
  nodes?: SwimNode[];
  bands?: SwimBand[];
  detail?: (n: SwimNode) => React.ReactNode;
  metrics?: ValidMetric[];
}) {
  const resolved: SwimBand[] =
    bands ??
    (() => {
      const real = (nodes ?? []).filter((n) => isRealLevel(n.level));
      const sorted = [...real].sort((a, b) => levelOrder(a.level) - levelOrder(b.level));
      return LEVELS.map((role) => ({
        role,
        nodes: sorted.filter((n) => n.level === role),
      }));
    })();

  return (
    <div className="px-4 py-5 sm:px-5">
      {resolved.map((b, i) => (
        <div key={b.role}>
          {i > 0 && <div className="h-px bg-border" aria-hidden />}
          <Band role={b.role} nodes={b.nodes} detail={detail} />
        </div>
      ))}
      <p className="mt-2 text-[11px] leading-relaxed text-muted">
        供给方向：上游决定成本与产能供给，中游完成加工与性能实现，下游形成需求反馈。
        <span className="ml-1">环节之间的连线需要真实的供应关系数据支撑，当前尚未建立，因此不绘制。</span>
      </p>
      <MetricStrip metrics={metrics} />
    </div>
  );
}
