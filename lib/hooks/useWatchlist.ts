"use client";

import { useCallback, useEffect, useState } from "react";

export interface WatchItem {
  secid: string;
  code: string;
  name: string;
  kind: "stock" | "index" | "etf" | "sector";
}

const KEY = "max-fm-watchlist";

export function useWatchlist() {
  const [items, setItems] = useState<WatchItem[]>([]);

  useEffect(() => {
    let local: WatchItem[] = [];
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) local = JSON.parse(raw);
      setItems(local);
    } catch {
      /* ignore */
    }

    // 与服务端合并。
    // 此前自选只存 localStorage，而 /account 的「我的自选」读 DB —— 两条链路从不互通，
    // 于是加自选后账号页恒为空。这里在挂载时拉取服务端列表并与本地合并（按 secid 去重）。
    // 未登录时接口返回 401，属预期，静默跳过。
    (async () => {
      try {
        const res = await fetch("/api/watchlist", { cache: "no-store" });
        if (!res.ok) return;
        const j = await res.json();
        if (!j?.ok || !Array.isArray(j.items)) return;
        const remote: WatchItem[] = j.items.map((r: { code: string; name: string }) => ({
          secid: r.code,
          code: r.code,
          name: r.name,
          // 服务端表里没有 kind；按代码形态推断，板块为 BK 开头
          kind: /^BK/i.test(r.code) ? "sector" : /^SH|^SZ/i.test(r.code) ? "index" : "stock",
        }));
        const seen = new Set(local.map((i) => i.secid));
        const merged = [...local, ...remote.filter((r) => !seen.has(r.secid))];
        if (merged.length !== local.length) {
          setItems(merged);
          try { localStorage.setItem(KEY, JSON.stringify(merged)); } catch { /* ignore */ }
        }
      } catch {
        /* 未登录或网络失败：保持本地状态 */
      }
    })();
  }, []);

  const persist = useCallback((next: WatchItem[]) => {
    setItems(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = useCallback(
    (item: WatchItem) => {
      const existed = items.some((i) => i.secid === item.secid);
      persist(existed ? items.filter((i) => i.secid !== item.secid) : [...items, item]);
      // 同步到服务端，失败静默（本地已生效，不因网络问题回滚 UI）
      fetch("/api/watchlist/toggle", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: item.secid, name: item.name, action: existed ? "remove" : "add" }),
      }).catch(() => { /* ignore */ });
    },
    [items, persist]
  );

  const remove = useCallback(
    (secid: string) => {
      persist(items.filter((i) => i.secid !== secid));
      const it = items.find((i) => i.secid === secid);
      fetch("/api/watchlist/toggle", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: secid, name: it?.name ?? secid, action: "remove" }),
      }).catch(() => { /* ignore */ });
    },
    [items, persist]
  );

  const has = useCallback((secid: string) => items.some((i) => i.secid === secid), [items]);

  return { items, toggle, remove, has };
}