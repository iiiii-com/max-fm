"use client";

/* ============================================================
   ShellChrome —— 站点壳路由化
   /lab 为全屏终端（复刻 GMT 布局），隐藏站点级 Header/Footer/面包屑；
   其余路由保持站点壳不变。
   ============================================================ */
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export default function ShellChrome(props: {
  header: ReactNode;
  breadcrumbs: ReactNode;
  footer: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const isTerminal = pathname === "/lab";
  if (isTerminal) return <>{props.children}</>;
  return (
    <>
      {props.header}
      <main id="main" className="flex-1">
        {props.breadcrumbs}
        {props.children}
      </main>
      {props.footer}
    </>
  );
}
