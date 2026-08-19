import Link from "next/link";
import type { ReactNode } from "react";

export default function BoardCard({
  href, title, desc, icon, accent, children,
}: {
  href: string; title: string; desc: string; icon: ReactNode; accent: string; children?: ReactNode;
}) {
  return (
    <Link href={href} className="card p-5 hover:shadow-md hover:border-primary/40 transition-all group block">
      <div className="flex items-center gap-2 mb-2">
        <span className={`flex items-center justify-center w-9 h-9 rounded-lg ${accent} text-white`}>{icon}</span>
        <h2 className="font-bold text-lg">{title}</h2>
      </div>
      <p className="text-sm text-muted mb-3">{desc}</p>
      {children && <div className="text-xs">{children}</div>}
      <p className="text-xs text-primary mt-3 opacity-0 group-hover:opacity-100 transition-opacity">进入 →</p>
    </Link>
  );
}