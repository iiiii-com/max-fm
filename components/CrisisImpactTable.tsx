import Link from "next/link";
import { CRISES } from "@/lib/data/crisis/crises";
import { Card, SectionTitle, Badge } from "@/components/ui";

const LEVEL_META: Record<string, { label: string; tone: "red" | "blue" | "gray" }> = {
  major: { label: "特大危机", tone: "red" },
  standard: { label: "标准危机", tone: "blue" },
  brief: { label: "简版", tone: "gray" },
};

function firstSentence(text: string): string {
  const s = text.split("。")[0].trim();
  return s.length > 40 ? `${s.slice(0, 40)}…` : s;
}

function yearWindow(period: [string, string]): string {
  const from = period[0].slice(0, 4);
  const to = period[1].slice(0, 4);
  return from === to ? from : `${from}—${to}`;
}

export default function CrisisImpactTable() {
  return (
    <section>
      <SectionTitle title="历史危机对指数的实际影响" sub="点击任意一行进入危机重演引擎" />
      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b border-border">
              <th className="py-3 pl-4 pr-4 font-medium">危机</th>
              <th className="py-3 pr-4 font-medium">级别</th>
              <th className="py-3 pr-4 font-medium">时间窗</th>
              <th className="py-3 pr-4 font-medium">主市场</th>
              <th className="py-3 pr-4 font-medium">实际影响</th>
            </tr>
          </thead>
          <tbody>
            {CRISES.map((c) => (
              <tr key={c.id} className="border-b border-border/50 last:border-0">
                <td colSpan={5} className="p-0">
                  <Link
                    href="/history?tab=crisis"
                    className="grid grid-cols-1 md:grid-cols-[1.2fr_auto_auto_1fr_2.5fr] items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-border/20 transition-colors"
                  >
                    <span className="font-semibold whitespace-nowrap">{c.title}</span>
                    <span>
                      <Badge tone={LEVEL_META[c.level]?.tone ?? "gray"}>{LEVEL_META[c.level]?.label ?? c.level}</Badge>
                    </span>
                    <span className="text-xs text-muted font-mono whitespace-nowrap">{yearWindow(c.period)}</span>
                    <span className="text-xs text-muted truncate">{c.markets[0]?.name ?? "—"}</span>
                    <span className="text-xs text-muted leading-relaxed">{firstSentence(c.impact)}</span>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </section>
  );
}