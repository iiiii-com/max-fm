import type { ReactNode } from "react";
import { Construction } from "lucide-react";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3",
        className
      )}
    >
      <div className="min-w-0">
        <h1 className="text-[22px] font-semibold leading-tight tracking-tight">
          {title}
        </h1>
        {description && (
          <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

export function ComingSoon({ title }: { title: string }) {
  return (
    <div className="surface-lit relative overflow-hidden rounded-xl border border-dashed">
      <div className="grid-texture pointer-events-none absolute inset-0 opacity-40" />
      <div className="relative flex flex-col items-center justify-center gap-3 px-6 py-20 text-center">
        <span className="flex size-10 items-center justify-center rounded-xl border bg-card text-primary shadow-hairline">
          <Construction className="size-4.5" />
        </span>
        <div>
          <p className="text-[13px] font-medium">「{title}」正在建设中</p>
          <p className="mt-1 text-xs text-muted-foreground">
            该模块的能力已在规划中，上方导航里的其他模块已可用。
          </p>
        </div>
      </div>
    </div>
  );
}
