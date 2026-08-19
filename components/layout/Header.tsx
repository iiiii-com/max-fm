"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "@/components/theme-provider";
import { Search, Moon, Sun, User } from "lucide-react";
import Ticker from "./Ticker";

const NAV = [
  { href: "/macro", label: "宏观经济" },
  { href: "/policy", label: "政策解读" },
  { href: "/invest", label: "投资分析" },
  { href: "/map", label: "经济分布图" },
  { href: "/industry", label: "产业链" },
  { href: "/advice", label: "个人建议" },
];

export default function Header({ user }: { user?: { name: string } | null }) {
  const pathname = usePathname();
  const { theme, toggle } = useTheme();

  return (
    <header className="sticky top-0 z-50 bg-card/95 backdrop-blur border-b border-border">
      <div className="mx-auto max-w-7xl px-4">
        <div className="flex items-center gap-4 h-14">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <span className="flex items-center justify-center w-8 h-8 rounded-md bg-primary text-white font-black text-lg">M</span>
            <span className="font-bold text-xl tracking-tight">Max 财经</span>
          </Link>
          <nav className="hidden lg:flex items-center gap-1 flex-1">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                  pathname.startsWith(n.href) ? "bg-primary/10 text-primary font-semibold" : "text-foreground/80 hover:bg-border/60"
                }`}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2 ml-auto">
            <Link href="/search" className="p-2 rounded-md hover:bg-border/60" aria-label="搜索">
              <Search className="w-4.5 h-4.5" />
            </Link>
            <button onClick={toggle} className="p-2 rounded-md hover:bg-border/60" aria-label="切换主题">
              {theme === "light" ? <Moon className="w-4.5 h-4.5" /> : <Sun className="w-4.5 h-4.5" />}
            </button>
            {user ? (
              <Link href="/advice" className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-white text-sm font-medium">
                <User className="w-4 h-4" /> {user.name}
              </Link>
            ) : (
              <Link href="/login" className="px-3 py-1.5 rounded-md border border-primary text-primary text-sm font-medium hover:bg-primary/5">
                登录
              </Link>
            )}
          </div>
        </div>
        <Ticker />
      </div>
    </header>
  );
}