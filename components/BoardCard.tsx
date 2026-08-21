import Link from "next/link";
import type { ReactNode } from "react";

export default function BoardCard({
  href, title, desc, icon, accent, children,
}: {
  href: string; title: string; desc: string; icon: ReactNode; accent: string; children?: ReactNode;
}) {
  return (
    <div className="card p-5 hover:shadow-md hover:border-primary/40 transition-all">
      <Link href={href} className="block group">
        <div className="flex items-center gap-2 mb-2">
          <span className={`flex items-center justify-center w-9 h-9 rounded-lg ${accent} text-white`}>{icon}</span>
          <h2 className="font-bold text-lg group-hover:text-primary transition-colors">{title}</h2>
        </div>
        <p className="text-sm text-muted mb-2">{desc}</p>
        <p className="text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity">进入板块 →</p>
      </Link>
      {children && <div className="mt-3 pt-3 border-t border-border">{children}</div>}
    </div>
  );
}
