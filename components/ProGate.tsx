import Link from "next/link";
import { Lock } from "lucide-react";
import { PRO_FEATURE_MAP, PLAN_LABEL } from "@/lib/plan";

/**
 * 专业版能力锁定态。
 *
 * 关键：不显示空白，也不假装"加载中"。要如实说清三件事 ——
 *   1) 这块是什么能力
 *   2) 普通版已经能看到什么（避免让人觉得整块被砍）
 *   3) 专业版多出什么（这才是升级的理由）
 * 把 free/pro 的差异直接摊在锁定位置，比任何营销文案都有效。
 */
export default function ProGate({
  feature,
  compact = false,
}: {
  feature: string;
  compact?: boolean;
}) {
  const f = PRO_FEATURE_MAP[feature];
  if (!f) return null;

  if (compact) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-dashed border-primary/40 bg-primary/5 px-3 py-2">
        <Lock className="w-3.5 h-3.5 text-primary shrink-0" />
        <p className="text-[11px] text-muted leading-relaxed">
          <b className="text-foreground">{f.name}</b> 为{PLAN_LABEL.pro}能力 · 普通版可见：{f.free}
          <Link href="/pricing" className="ml-1.5 text-primary hover:underline font-medium">
            了解专业版
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-dashed border-primary/40 bg-primary/5 p-4">
      <div className="flex items-center gap-2 mb-2">
        <Lock className="w-4 h-4 text-primary" />
        <span className="text-sm font-bold">{f.name}</span>
        <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-primary text-white">
          {PLAN_LABEL.pro}
        </span>
      </div>
      <dl className="text-[11px] leading-relaxed space-y-1.5">
        <div className="flex gap-2">
          <dt className="shrink-0 text-muted font-semibold w-14">普通版</dt>
          <dd className="text-muted">{f.free}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="shrink-0 text-primary font-semibold w-14">专业版</dt>
          <dd className="text-foreground/85">{f.pro}</dd>
        </div>
      </dl>
      {f.modules.length > 0 && (
        <div className="flex items-center gap-2 mt-2.5 flex-wrap">
          <span className="text-[10px] text-muted">落地模块</span>
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
      )}
      <Link
        href="/pricing"
        className="inline-block mt-3 text-xs font-medium text-primary hover:underline"
      >
        查看专业版全部能力 →
      </Link>
    </div>
  );
}