"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useTheme } from "@/components/theme-provider";
import { Search, Moon, Sun, User, Menu, X, ChevronDown } from "lucide-react";
import Ticker from "./Ticker";
import { NAV, isGroupActive } from "./nav";

export default function Header({ user }: { user?: { name: string } | null }) {
  const pathname = usePathname();
  const { theme, toggle } = useTheme();
  const [open, setOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState<string | null>(null);

  return (
    <header className="sticky top-0 z-50 bg-card/95 backdrop-blur border-b border-border safe-top">
      <div className="mx-auto max-w-7xl px-3 sm:px-4">
        <div className="flex items-center gap-2 sm:gap-4 h-14">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <span className="flex items-center justify-center w-8 h-8 rounded-md bg-primary text-white font-black text-lg">M</span>
            <span className="font-bold text-lg sm:text-xl tracking-tight hidden sm:inline">Max 财经</span>
          </Link>

          {/* 桌面端：四大板块 + 二级下拉 */}
          <nav className="hidden lg:flex items-center gap-0.5 flex-1" aria-label="主导航">
            {NAV.map((g) => {
              const active = isGroupActive(g.href, pathname);
              return (
                <div key={g.href} className="relative group">
                  <Link
                    href={g.href}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm transition-colors ${
                      active ? "bg-primary/10 text-primary font-semibold" : "text-foreground/80 hover:bg-border/60"
                    }`}
                  >
                    {g.label}
                    <ChevronDown className="w-3.5 h-3.5 opacity-50 transition-transform duration-200 group-hover:rotate-180" />
                  </Link>
                  {/* 下拉面板 */}
                  <div className="absolute left-0 top-full pt-2 invisible opacity-0 -translate-y-1 group-hover:visible group-hover:opacity-100 group-hover:translate-y-0 group-focus-within:visible group-focus-within:opacity-100 transition-all duration-150">
                    <div className="w-72 rounded-lg border border-border bg-card shadow-lg shadow-black/5 overflow-hidden">
                      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-background/70">
                        <g.icon className="w-4 h-4 text-primary shrink-0" />
                        <span className="text-xs font-semibold tracking-wide">{g.label}</span>
                        <span className="text-[11px] text-muted truncate">{g.desc}</span>
                      </div>
                      <ul className="p-1.5">
                        {g.children.map((c) => {
                          const cActive = pathname === c.href.split("?")[0] && !pathname.includes(c.href.split("?")[0] + "/");
                          return (
                            <li key={c.href}>
                              <Link
                                href={c.href}
                                className={`flex items-start gap-2.5 px-2.5 py-2 rounded-md transition-colors ${
                                  cActive ? "bg-primary/5" : "hover:bg-primary/5"
                                }`}
                              >
                                <c.icon className={`w-4 h-4 mt-0.5 shrink-0 ${cActive ? "text-primary" : "text-muted"}`} />
                                <span className="min-w-0">
                                  <span className={`block text-sm ${cActive ? "text-primary font-medium" : "font-medium"}`}>{c.label}</span>
                                  <span className="block text-xs text-muted truncate">{c.desc}</span>
                                </span>
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </div>
                </div>
              );
            })}
          </nav>

          <div className="flex items-center gap-2 ml-auto">
            <Link href="/search" className="p-2 rounded-md hover:bg-border/60" aria-label="搜索">
              <Search className="w-4.5 h-4.5" />
            </Link>
            <button onClick={toggle} className="p-2.5 rounded-md hover:bg-border/60 flex items-center justify-center w-10 h-10" aria-label="切换主题">
              {theme === "light" ? <Moon className="w-4.5 h-4.5" /> : <Sun className="w-4.5 h-4.5" />}
            </button>
            <button
              onClick={() => {
                setOpen(!open);
                setMobileOpen(null);
              }}
              className="lg:hidden p-2.5 rounded-md hover:bg-border/60 flex items-center justify-center w-10 h-10"
              aria-label="菜单"
            >
              {open ? <X className="w-4.5 h-4.5" /> : <Menu className="w-4.5 h-4.5" />}
            </button>
            {user ? (
              <Link href="/account" className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-white text-sm font-medium min-h-0">
                <User className="w-4 h-4" /> <span className="hidden sm:inline">{user.name}</span>
              </Link>
            ) : (
              <Link href="/login" className="flex px-3 py-2 rounded-md border border-primary text-primary text-sm font-medium hover:bg-primary/5">
                登录
              </Link>
            )}
          </div>
        </div>

        {/* 移动端：手风琴二级导航 */}
        {open && (
          <nav className="lg:hidden border-t border-border py-2 pb-[calc(0.5rem+var(--safe-bottom))]" aria-label="移动端导航">
            {NAV.map((g) => {
              const active = isGroupActive(g.href, pathname);
              const expanded = mobileOpen === g.href;
              return (
                <div key={g.href} className="border-b border-border/70 last:border-0">
                  <div className="flex items-center">
                    <Link
                      href={g.href}
                      onClick={() => setOpen(false)}
                      className={`flex-1 flex items-center gap-2 px-3 py-2.5 text-sm ${
                        active ? "text-primary font-semibold" : "text-foreground/85"
                      }`}
                    >
                      <g.icon className="w-4 h-4" />
                      {g.label}
                    </Link>
                    <button
                      onClick={() => setMobileOpen(expanded ? null : g.href)}
                      className="p-2.5 text-muted"
                      aria-label={expanded ? `收起${g.label}` : `展开${g.label}`}
                      aria-expanded={expanded}
                    >
                      <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`} />
                    </button>
                  </div>
                  {expanded && (
                    <div className="pb-2 pl-4 pr-2 grid gap-0.5">
                      {g.children.map((c) => {
                        const cActive = pathname === c.href.split("?")[0] && !pathname.includes(c.href.split("?")[0] + "/");
                        return (
                          <Link
                            key={c.href}
                            href={c.href}
                            onClick={() => setOpen(false)}
                            className={`flex items-start gap-2.5 px-3 py-2 rounded-md text-sm ${
                              cActive ? "bg-primary/5 text-primary" : "hover:bg-primary/5"
                            }`}
                          >
                            <c.icon className={`w-4 h-4 mt-0.5 shrink-0 ${cActive ? "text-primary" : "text-muted"}`} />
                            <span className="min-w-0">
                              <span className="block font-medium">{c.label}</span>
                              <span className="block text-xs text-muted truncate">{c.desc}</span>
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        )}

        <Ticker />
      </div>
    </header>
  );
}
