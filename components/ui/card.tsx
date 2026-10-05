import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Card({
  className,
  interactive,
  children,
  ...rest
}: {
  className?: string;
  interactive?: boolean;
  children: ReactNode;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "surface-lit rounded-xl border bg-card",
        interactive &&
          "transition-[border-color,box-shadow,transform] duration-150 hover:border-border-strong hover:shadow-float",
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  icon,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-3 px-3.5 pb-2.5 pt-3", className)}>
      <div className="flex min-w-0 items-start gap-2.5">
        {icon && (
          <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-subtle text-muted-foreground [&_svg]:size-3.5">
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <h3 className="truncate text-[13px] font-semibold tracking-tight">{title}</h3>
          {description && (
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              {description}
            </p>
          )}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function CardBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("px-3.5 pb-3.5", className)}>{children}</div>;
}

export function SectionLabel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "px-2 text-[10.5px] font-semibold uppercase tracking-[0.09em] text-subtle-foreground",
        className
      )}
    >
      {children}
    </p>
  );
}
