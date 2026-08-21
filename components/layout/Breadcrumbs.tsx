"use client";

import Link from "next/link";
import { Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { breadcrumbsFor } from "./nav";

/** 全局面包屑：挂载在 layout 的 main 顶部，依据路径自动渲染。 */
export default function Breadcrumbs() {
  return (
    <Suspense fallback={null}>
      <BreadcrumbsInner />
    </Suspense>
  );
}

function BreadcrumbsInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const crumbs = breadcrumbsFor(pathname, searchParams);

  if (crumbs.length === 0) return null;

  return (
    <nav aria-label="面包屑" className="mx-auto max-w-7xl px-4 pt-3">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          return (
            <li key={`${c.label}-${i}`} className="flex items-center gap-2">
              {i > 0 && <span className="text-muted/40 select-none" aria-hidden>/</span>}
              {c.href && !last ? (
                <Link href={c.href} className="hover:text-primary transition-colors">
                  {c.label}
                </Link>
              ) : (
                <span className={last ? "text-foreground font-medium" : ""}>{c.label}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
