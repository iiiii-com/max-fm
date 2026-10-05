import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "primary" | "success" | "warning" | "destructive" | "info" | "outline";

const TONES: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground",
  primary: "bg-primary-subtle text-primary-subtle-foreground",
  success: "bg-success/12 text-success",
  warning: "bg-warning/14 text-warning-foreground dark:text-warning",
  destructive: "bg-destructive/12 text-destructive",
  info: "bg-info/12 text-info",
  outline: "border border-border text-muted-foreground",
};

export function Badge({
  tone = "neutral",
  className,
  children,
  dot,
}: {
  tone?: Tone;
  className?: string;
  children: ReactNode;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-[5px] px-1.5 py-px text-[11px] font-medium leading-[1.55] whitespace-nowrap",
        TONES[tone],
        className
      )}
    >
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}
