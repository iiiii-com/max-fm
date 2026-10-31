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
      {/*
        主区最小高度：页面正文是流式的（首帧只有短壳，数据到达后分批长高）。
        如果 main 一开始只有几百 px，footer 会在首帧就进入视口，随后被不断下推 ——
        实测 /macro、/macro/feeling、/stock 等页的 CLS 主要来源就是 footer 位移。
        这里让 main 首帧就接近一屏高，footer 从第一帧起就在视口之外；
        对内容本来就短的页面没有副作用（body 是 flex-col，main 的 flex-1 本来就会把它撑满一屏）。
      */}
      <main id="main" className="flex-1 min-h-[calc(100svh-57px)]">
        {props.breadcrumbs}
        {props.children}
      </main>
      {props.footer}
    </>
  );
}
