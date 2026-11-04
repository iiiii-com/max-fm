"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

/**
 * 「重新采集」按钮：触发 Server Component 重新执行（router.refresh）。
 * 溯源报告本身有 60 秒缓存，这里不做强刷 —— 需要跳过缓存看最新值时用
 * 页面里的「机器可读」链接加 ?fresh=1。
 */
export default function RefreshButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [clicked, setClicked] = useState(false);

  return (
    <button
      type="button"
      onClick={() => {
        setClicked(true);
        startTransition(() => router.refresh());
        window.setTimeout(() => setClicked(false), 1500);
      }}
      className="px-3 py-1.5 rounded-lg text-sm border border-border hover:border-primary/50 transition-colors disabled:opacity-60"
      disabled={pending}
    >
      {pending ? "采集中…" : clicked ? "已刷新" : "重新采集"}
    </button>
  );
}
