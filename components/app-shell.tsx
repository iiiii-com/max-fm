"use client";

import { useState, type ReactNode } from "react";
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
  Zap,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "仪表盘", icon: LayoutDashboard },
  { href: "/tasks", label: "任务", icon: ListTodo },
  { href: "/attendance", label: "考勤", icon: CalendarCheck2 },
  { href: "/timelogs", label: "工时", icon: Timer },
  { href: "/reports", label: "报表", icon: BarChart3 },
  { href: "/goals", label: "目标", icon: Target },
  { href: "/habits", label: "习惯", icon: Flame },
  { href: "/weekly", label: "周报", icon: FileText },
] as const;

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

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  const nav = (
    <nav className="flex flex-1 flex-col gap-1 px-3">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={() => setMobileOpen(false)}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <Icon className="size-4 shrink-0" />
            {label}
          </Link>
        );
      })}
    </nav>
  );

  const brandAndUser = (
    <>
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Zap className="size-4" />
        </div>
        <span className="text-base font-bold tracking-tight">效率工作台</span>
      </div>
      <div className="border-t px-5 py-4">
        <div className="mb-3 flex items-center gap-2 text-sm">
          <div className="flex size-7 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">
            {userName.slice(0, 1)}
          </div>
          <span className="truncate font-medium">{userName}</span>
        </div>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-destructive"
        >
          <LogOut className="size-4" />
          退出登录
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen">
      {/* 桌面侧边栏 */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-56 flex-col border-r bg-card md:flex">
        {brandAndUser}
        {nav}
      </aside>

      {/* 移动端顶栏 */}
      <header className="sticky top-0 z-40 flex h-12 items-center justify-between border-b bg-card/95 px-4 backdrop-blur md:hidden">
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="打开菜单"
          className="rounded-md p-1.5 text-muted-foreground hover:bg-accent"
        >
          <Menu className="size-5" />
        </button>
        <span className="font-semibold">效率工作台</span>
        <span className="w-9" />
      </header>

      {/* 移动端抽屉 */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col border-r bg-card">
            <button
              onClick={() => setMobileOpen(false)}
              aria-label="关闭菜单"
              className="absolute right-2 top-3 rounded-md p-1.5 text-muted-foreground hover:bg-accent"
            >
              <X className="size-4" />
            </button>
            {brandAndUser}
            {nav}
          </aside>
        </div>
      )}

      <main className="px-4 py-6 md:ml-56 md:px-8">{children}</main>
    </div>
  );
}
