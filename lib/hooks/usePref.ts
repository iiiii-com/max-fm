"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * 带 localStorage 持久化的偏好开关。
 *
 * 为什么需要：图表的显隐选项（悬停卡片、指标线…）属于「用户的习惯」，
 * 不该每次刷新/换页都重置。K 线控制条上那些 useState 开关是会话级的，
 * 用户关掉悬停卡、切到别的股票又冒出来，会反复被打扰。
 *
 * 读取放在 useEffect 里（不在 useState 初值里）：
 * 服务端与首帧都用 initial，避免 hydration 不一致；
 * 挂载后再校正为存储值。对图表 option 而言这只是重渲染，不会闪 DOM。
 */
export function usePref<T>(key: string, initial: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(initial);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw != null) setValue(JSON.parse(raw) as T);
    } catch {
      /* 存储不可用或内容损坏：保持默认值即可 */
    }
  }, [key]);

  const set = useCallback(
    (next: T) => {
      setValue(next);
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        /* 隐私模式下写入会抛错，不影响本次会话内的切换 */
      }
    },
    [key],
  );

  return [value, set];
}
