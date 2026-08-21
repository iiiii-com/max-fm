import Link from "next/link";
import { NAV, FOOTER_UTILITY } from "./nav";

export default function Footer() {
  return (
    <footer className="border-t border-border mt-12">
      <div className="mx-auto max-w-7xl px-4 py-10 text-sm text-muted">
        {/* 站点地图 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
          {NAV.map((g) => (
            <div key={g.href}>
              <Link href={g.href} className="flex items-center gap-1.5 mb-3 text-foreground font-semibold hover:text-primary transition-colors">
                <g.icon className="w-4 h-4 text-primary" />
                {g.label}
              </Link>
              <ul className="space-y-1.5">
                {g.children.map((c) => (
                  <li key={c.href}>
                    <Link href={c.href} className="hover:text-foreground hover:underline transition-colors">
                      {c.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex flex-col md:flex-row gap-4 md:items-center justify-between border-t border-border pt-6">
          <div>
            <p className="font-bold text-foreground mb-1">Max 财经数据平台</p>
            <p className="text-xs">AI 自动生成的内容仅供参考，不构成任何投资建议。数据来源于公开渠道，可能存在延迟或误差。</p>
          </div>
          <nav className="flex gap-4 text-xs">
            {FOOTER_UTILITY.map((l) => (
              <Link key={l.href} href={l.href} className="hover:text-foreground">
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
        <p className="mt-4 text-xs opacity-70">© {new Date().getFullYear()} Max 财经 · 用数据理解经济，用理性面对温差</p>
      </div>
    </footer>
  );
}
