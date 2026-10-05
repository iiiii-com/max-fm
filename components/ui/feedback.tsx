import type { ComponentType, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function StatTile({
  label,
  value,
  unit,
  icon: Icon,
  tone = "neutral",
  hint,
  className,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  icon?: ComponentType<{ className?: string }>;
  tone?: "neutral" | "primary" | "success" | "warning" | "destructive";
  hint?: string;
  className?: string;
}) {
  const toneCls: Record<string, string> = {
    neutral: "text-foreground",
    primary: "text-primary",
    success: "text-success",
    warning: "text-warning",
    destructive: "text-destructive",
  };
  return (
    <div
      className={cn(
        "surface-lit group relative overflow-hidden rounded-xl border bg-card px-3.5 py-3 transition-[border-color,box-shadow] duration-200 hover:border-border-strong hover:shadow-float",
        className
      )}
    >
      <div className="flex items-center gap-1.5">
        {Icon && <Icon className="size-3.5 text-subtle-foreground" />}
        <p className="truncate text-[11.5px] font-medium text-muted-foreground">{label}</p>
      </div>
      <p className={cn("mt-1.5 flex items-baseline gap-1 text-[22px] leading-none font-semibold tabular tracking-tight", toneCls[tone])}>
        {value}
        {unit && <span className="text-xs font-medium text-subtle-foreground">{unit}</span>}
      </p>
      {hint && <p className="mt-1.5 truncate text-[11px] text-subtle-foreground">{hint}</p>}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2.5 rounded-xl border border-dashed border-border px-6 py-14 text-center",
        className
      )}
    >
      {icon && (
        <span className="flex size-9 items-center justify-center rounded-lg border bg-subtle text-subtle-foreground [&_svg]:size-4">
          {icon}
        </span>
      )}
      <p className="text-[13px] font-medium">{title}</p>
      {description && (
        <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-1.5">{action}</div>}
    </div>
  );
}

export function Loading({ label = "加载中", className }: { label?: string; className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 py-16 text-subtle-foreground",
        className
      )}
    >
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="size-1.5 animate-shimmer rounded-full bg-primary/70"
            style={{ animationDelay: `${i * 0.16}s` }}
          />
        ))}
      </div>
      <p className="text-xs">{label}</p>
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded border bg-subtle px-1 py-px font-mono text-[10px] text-muted-foreground">
      {children}
    </kbd>
  );
}
