"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  ListTodo,
  CalendarCheck2,
  Timer,
  BarChart3,
  Target,
  Flame,
  FileText,
  LogOut,
  Menu,
  X,
  Sun,
  Moon,
  Command,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SectionLabel } from "@/components/ui/card";

const NAV_GROUPS = [
  {
    label: "工作区",
    items: [
      { href: "/dashboard", label: "仪表盘", icon: LayoutDashboard },
      { href: "/tasks", label: "任务", icon: ListTodo },
      { href: "/attendance", label: "考勤", icon: CalendarCheck2 },
      { href: "/timelogs", label: "工时", icon: Timer },
    ],
  },
  {
    label: "洞察",
    items: [{ href: "/reports", label: "报表", icon: BarChart3 }],
  },
  {
    label: "自我管理",
    items: [
      { href: "/goals", label: "目标", icon: Target },
      { href: "/habits", label: "习惯", icon: Flame },
      { href: "/weekly", label: "周报", icon: FileText },
    ],
  },
] as const;

function useTheme() {
  const [dark, setDark] = useState<boolean | null>(null);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("max-theme", next ? "dark" : "light");
    } catch {}
    setDark(next);
  }

  return { dark, toggle };
}

function ThemeToggle() {
  const { dark, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      aria-label={dark ? "切换到浅色模式" : "切换到深色模式"}
      title={dark ? "浅色模式" : "深色模式"}
      className="flex size-7 items-center justify-center rounded-md text-subtle-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      {dark === null ? (
        <span className="size-3.5" />
      ) : dark ? (
        <Sun className="size-3.5" />
      ) : (
        <Moon className="size-3.5" />
      )}
    </button>
  );
}

function Brand() {
  return (
    <div className="flex h-14 items-center gap-2.5 px-4">
      <span className="relative flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-[7px] bg-gradient-to-br from-cyan-bright to-primary text-primary-foreground shadow-hairline">
        <Command className="size-3.5" />
        <span className="pointer-events-none absolute inset-0 rounded-[7px] ring-1 ring-inset ring-white/25" />
      </span>
      <span className="truncate text-[13px] font-semibold tracking-tight">效率工作台</span>
    </div>
  );
}

export function AppShell({
  children,
  userName,
}: {
  children: ReactNode;
  userName: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  const nav = (
    <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
      {NAV_GROUPS.map((group) => (
        <div key={group.label}>
          <SectionLabel className="mb-1.5">{group.label}</SectionLabel>
          <div className="space-y-0.5">
            {group.items.map(({ href, label, icon: Icon }) => {
              const active = pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group flex h-7 items-center gap-2.5 rounded-md px-2.5 text-[13px] transition-colors duration-150",
                    active
                      ? "bg-accent font-medium text-foreground"
                      : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                  )}
                >
                  <Icon
                    className={cn(
                      "size-4 shrink-0 transition-colors",
                      active
                        ? "text-primary"
                        : "text-subtle-foreground group-hover:text-muted-foreground"
                    )}
                  />
                  <span className="truncate">{label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  const footer = (
    <div className="border-t p-3">
      <div className="flex items-center gap-2.5 rounded-lg px-1.5 py-1.5">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground">
          {userName.slice(0, 1)}
        </span>
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{userName}</span>
        <div className="flex items-center gap-0.5">
          <ThemeToggle />
          <button
            onClick={handleLogout}
            aria-label="退出登录"
            title="退出登录"
            className="flex size-7 items-center justify-center rounded-md text-subtle-foreground transition-colors hover:bg-accent hover:text-destructive"
          >
            <LogOut className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r bg-background md:flex">
        <Brand />
        {nav}
        {footer}
      </aside>

      <header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b bg-background/85 px-3 backdrop-blur-xl md:hidden">
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="打开菜单"
          className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <Menu className="size-4.5" />
        </button>
        <Brand />
      </header>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 animate-fade-in bg-foreground/25 backdrop-blur-[2px] dark:bg-black/60"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="surface-lit absolute inset-y-0 left-0 flex w-64 animate-rise flex-col border-r bg-popover shadow-overlay">
            <div className="flex items-center justify-between pr-2.5">
              <Brand />
              <button
                onClick={() => setMobileOpen(false)}
                aria-label="关闭菜单"
                className="flex size-7 items-center justify-center rounded-md text-subtle-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>
            {nav}
            {footer}
          </aside>
        </div>
      )}

      <main className="md:pl-60">
        <div className="mx-auto w-full max-w-[1600px] px-4 py-5 sm:px-6 lg:px-7 lg:py-6">
          {children}
        </div>
      </main>
    </div>
  );
}
