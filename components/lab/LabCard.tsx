"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

/** 参考站风格的编号卡片：编号 + 标题 + as-of 时点 + 口径注释 + 折叠
 *  编号卡片仪表盘模式（01-08），每卡自带数据口径说明 —— 数据诚实原则。
 */
export default function LabCard({
  num,
  title,
  sub,
  asOf,
  note,
  children,
  action,
  className = "",
}: {
  num: string; // "01" ~ "08"
  title: string;
  sub?: string;
  asOf?: string; // 数据时点（如 "收盘 2026-08-28"）
  note?: ReactNode; // 口径注释（图注/来源/计算方法）
  children: ReactNode;
  action?: ReactNode; // 右上角操作区（周期切换等）
  className?: string;
}) {
  const [open, setOpen] = useState(true);
  return (
    <section id={`lab-${num}`} className={`card scroll-mt-24 ${open ? "" : "overflow-hidden"} ${className}`}>
      <header className="flex items-center gap-3 px-4 py-3 border-b border-border/70 flex-wrap">
        <span className="font-mono text-xl font-bold text-primary/90 tabular-nums select-none" aria-hidden>
          {num}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold leading-tight">{title}</h2>
          {sub && <p className="text-xs text-muted mt-0.5 truncate">{sub}</p>}
        </div>
        {action}
        {asOf && (
          <span className="text-[11px] text-muted font-mono shrink-0" title={`数据时点：${asOf}`}>
            as-of {asOf}
          </span>
        )}
        <button
          onClick={() => setOpen(!open)}
          className="p-1.5 rounded-md text-muted hover:text-foreground hover:bg-border/60 transition-colors shrink-0"
          aria-label={open ? `折叠 ${title}` : `展开 ${title}`}
          aria-expanded={open}
        >
          <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
        </button>
      </header>
      {open && (
        <>
          <div className="p-4">{children}</div>
          {note && (
            <p className="px-4 pb-3 text-[11px] text-muted leading-relaxed border-t border-border/50 pt-2.5 mx-0">{note}</p>
          )}
        </>
      )}
    </section>
  );
}
