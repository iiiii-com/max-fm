"use client";
import { useState } from "react";
import { Card } from "@/components/ui";

export type Dynasty = {
  name: string;
  period: string;
  years: string;
  rise: string;
  peak: string;
  decline: string;
  cause: string;
  note: string;
};

export default function DynastyTable({ dynasties }: { dynasties: Dynasty[] }) {
  const [query, setQuery] = useState("");
  const [openName, setOpenName] = useState<string | null>(null);
  const filtered = dynasties.filter((d) => !query || d.name.includes(query) || d.period.includes(query) || d.note.includes(query));
  return (
    <div className="space-y-4">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="搜索朝代（如：唐 / 明清 / 1764）"
        className="w-full md:w-80 px-3 py-2 rounded-lg border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/40"
      />
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b border-border">
              <th className="py-2 pl-4 pr-2 font-medium">朝代</th>
              <th className="py-2 px-2 font-medium whitespace-nowrap">时间</th>
              <th className="py-2 px-2 font-medium whitespace-nowrap">国祚</th>
              <th className="py-2 px-2 font-medium">崛起</th>
              <th className="py-2 px-2 font-medium">鼎盛</th>
              <th className="py-2 px-2 font-medium">衰落</th>
              <th className="py-2 pr-4 pl-2 font-medium">周期启示</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((d) => (
              <tr
                key={d.name}
                onClick={() => setOpenName(openName === d.name ? null : d.name)}
                className="border-b border-border/50 cursor-pointer hover:bg-border/20 transition-colors"
              >
                <td className="py-2.5 pl-4 pr-2 font-bold whitespace-nowrap">{d.name}</td>
                <td className="py-2.5 px-2 font-mono text-xs text-muted whitespace-nowrap">{d.period}</td>
                <td className="py-2.5 px-2 text-xs text-muted whitespace-nowrap">{d.years}</td>
                <td className="py-2.5 px-2 text-xs">{d.rise}</td>
                <td className="py-2.5 px-2 text-xs">{d.peak}</td>
                <td className="py-2.5 px-2 text-xs">{d.decline}</td>
                <td className="py-2.5 pr-4 pl-2 text-xs text-muted">{openName === d.name ? d.note : d.note.slice(0, 14) + (d.note.length > 14 ? "…" : "")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-muted px-1">点击任意行展开/收起「周期启示」备注。王朝更替 ≈ 300 年一轮，康波 ≈ 50—60 年一轮，两者嵌套：每个王朝通常经历 4—6 个康波。</p>
    </div>
  );
}