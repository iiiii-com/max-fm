import { cn } from "@/lib/utils";
import Link from "next/link";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("card p-4", className)}>{children}</div>;
}

export function StatCard({
  label, value, sub, delta, accent, href,
}: {
  label: string; value: string; sub?: string; delta?: number; accent?: boolean; href?: string;
}) {
  const inner = (
    <Card className={cn("hover:shadow-md transition-shadow", accent && "border-primary/40")}>
      <p className="text-xs text-muted mb-1">{label}</p>
      <p className="text-2xl font-bold font-mono leading-none">{value}</p>
      <div className="flex items-center gap-2 mt-2 text-xs">
        {delta !== undefined && (
          <span className={cn("flex items-center font-mono", delta >= 0 ? "up" : "down")}>
            {delta >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
            {delta >= 0 ? "+" : ""}{delta}%
          </span>
        )}
        {sub && <span className="text-muted">{sub}</span>}
      </div>
    </Card>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

export function Badge({ children, tone = "red" }: { children: React.ReactNode; tone?: "red" | "green" | "gray" | "amber" | "blue" | "purple" | "cyan" }) {
  const tones = {
    red: "bg-primary/10 text-primary",
    green: "bg-down/10 text-down",
    gray: "bg-border/60 text-muted",
    amber: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    blue: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
    purple: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
    cyan: "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400",
  };
  return <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-xs font-medium", tones[tone])}>{children}</span>;
}

export function SectionTitle({ title, sub, extra }: { title: string; sub?: string; extra?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between mb-4">
      <div>
        <h2 className="text-xl font-bold border-l-4 border-primary pl-3 leading-tight">{title}</h2>
        {sub && <p className="text-sm text-muted mt-1.5 pl-3">{sub}</p>}
      </div>
      {extra}
    </div>
  );
}

export function AIFlag() {
  return <Badge tone="gray">AI 生成</Badge>;
}