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
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch {
      /* ignore */
    }
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
      persist(items.some((i) => i.secid === item.secid) ? items.filter((i) => i.secid !== item.secid) : [...items, item]);
    },
    [items, persist]
  );

  const remove = useCallback(
    (secid: string) => persist(items.filter((i) => i.secid !== secid)),
    [items, persist]
  );

  const has = useCallback((secid: string) => items.some((i) => i.secid === secid), [items]);

  return { items, toggle, remove, has };
}