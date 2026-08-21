"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

/** 自动刷新间隔（毫秒） */
export const REFRESH_INTERVAL = 30_000;

const STORAGE_KEY = "max-auto-refresh";

interface RefreshCtx {
  /** 是否开启自动刷新 */
  enabled: boolean;
  toggle: () => void;
  /** 每次刷新递增，订阅方把它加入 effect 依赖即可重新取数 */
  refreshKey: number;
  /** 手动触发一次刷新 */
  bump: () => void;
  /** 最近一次数据更新时间戳 */
  lastUpdated: number;
}

const Ctx = createContext<RefreshCtx>({
  enabled: false,
  toggle: () => {},
  refreshKey: 0,
  bump: () => {},
  lastUpdated: 0,
});

export function RefreshProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [lastUpdated, setLastUpdated] = useState(() => Date.now());

  // 恢复持久化开关
  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === "1") setEnabled(true);
    } catch {
      /* ignore */
    }
  }, []);

  // 定时刷新
  useEffect(() => {
    if (!enabled) return;
    const t = setInterval(() => {
      setRefreshKey((k) => k + 1);
      setLastUpdated(Date.now());
    }, REFRESH_INTERVAL);
    return () => clearInterval(t);
  }, [enabled]);

  const toggle = useCallback(() => {
    setEnabled((e) => {
      const next = !e;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const bump = useCallback(() => {
    setRefreshKey((k) => k + 1);
    setLastUpdated(Date.now());
  }, []);

  const value = useMemo(
    () => ({ enabled, toggle, refreshKey, bump, lastUpdated }),
    [enabled, toggle, refreshKey, bump, lastUpdated]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useRefresh() {
  return useContext(Ctx);
}
