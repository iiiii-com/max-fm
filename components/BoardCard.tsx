import Link from "next/link";
import type { ReactNode } from "react";

/** 序号：替代原「五个板块各配一个随机彩色」的做法。
 *  研究类版式用序号 + 墨色建立层级，比彩色块更克制、更像目录。 */
export default function BoardCard({
  href, title, desc, icon, index, children,
}: {
  href: string; title: string; desc: string; icon: ReactNode; index: number; children?: ReactNode;
}) {
  return (
    <div className="card p-5 hover:border-border-strong transition-colors">
      <Link href={href} className="block group">
        <div className="flex items-start gap-3 mb-2">
          <span className="flex items-center justify-center w-9 h-9 rounded-md bg-primary-soft text-primary shrink-0">
            {icon}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-[11px] text-muted tabular-nums">
                {String(index).padStart(2, "0")}
              </span>
              <h2 className="font-bold text-base group-hover:underline decoration-1 underline-offset-4 transition-colors">
                {title}
              </h2>
            </div>
          </div>
        </div>
        <p className="text-sm text-muted mb-2 leading-relaxed">{desc}</p>
        <p className="text-xs text-muted opacity-0 group-hover:opacity-100 transition-opacity">
          进入板块 →
        </p>
      </Link>
      {children && <div className="mt-3 pt-3 border-t border-border">{children}</div>}
    </div>
  );
}
