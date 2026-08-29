"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="max-w-xl mx-auto px-4 py-20 text-center">
      <p className="font-mono text-5xl font-bold text-primary select-none">!</p>
      <h1 className="mt-4 text-xl font-bold">页面出了点问题</h1>
      <p className="mt-2 text-sm text-muted leading-relaxed">
        渲染时发生异常，可能是数据源临时不可用。可以尝试重新加载，或稍后再来。
      </p>
      <div className="mt-6 flex items-center justify-center gap-3">
        <button
          onClick={retry}
          className="h-10 px-5 text-sm rounded-md bg-primary text-white hover:bg-primary-dark transition-colors"
        >
          重新加载
        </button>
        <Link
          href="/"
          className="h-10 px-5 text-sm rounded-md border border-border bg-card inline-flex items-center hover:border-primary/50 transition-colors"
        >
          返回首页
        </Link>
      </div>
    </div>
  );
}
