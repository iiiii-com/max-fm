"use client";

/* ============================================================
   useLabGrid —— GMT 式可编辑网格布局
   桌面：12 列绝对定位（拖动移动 / 右下角缩放 / 锁定 / 最小化 / 放大 / 移除）
   窄屏：线性堆叠 + ▲▼ 调序（moveMobile）
   布局持久化 localStorage；preset 可整体重排
   ============================================================ */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export const COLS = 12;
export const ROWH = 84;
export const GAP = 8;

export interface GridItem {
  x: number;
  y: number;
  w: number;
  h: number;
  minimized?: boolean;
  locked?: boolean;
  visible?: boolean; // false = 已被 ✕ 移除，可在「添加组件」恢复
  mobileOrder?: number; // 窄屏排序
}

export type GridLayout = Record<string, GridItem>;

const STORAGE_KEY = "lab-grid-v1";

export interface PresetDef {
  key: string;
  label: string;
  layout: GridLayout;
}

/** 单位：列 x / 行 y（h 以 84px 行计） */
export function makeLayout(defs: Array<{ id: string; x: number; y: number; w: number; h: number }>): GridLayout {
  const out: GridLayout = {};
  defs.forEach((d, i) => {
    out[d.id] = { x: d.x, y: d.y, w: d.w, h: d.h, visible: true, mobileOrder: i };
  });
  return out;
}

export function useLabGrid(presets: PresetDef[], defaultKey = "ALL") {
  const [layout, setLayout] = useState<GridLayout>(() => presets.find((p) => p.key === defaultKey)?.layout ?? {});
  const [editing, setEditing] = useState(false);
  const [zoomed, setZoomed] = useState<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const [preset, setPreset] = useState(defaultKey);
  const hydrated = useRef(false);

  // 恢复持久化布局
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as GridLayout;
        // 合并：保留 presets 中新增卡片的默认位置
        const merged: GridLayout = { ...saved };
        for (const [id, item] of Object.entries(presets.find((p) => p.key === defaultKey)?.layout ?? {})) {
          if (!merged[id]) merged[id] = item;
        }
        setLayout(merged);
      }
    } catch {
      /* 损坏则用默认 */
    }
    hydrated.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persist = useCallback((next: GridLayout) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* 忽略配额错误 */
    }
  }, []);

  const update = useCallback(
    (id: string, patch: Partial<GridItem>) => {
      setLayout((prev) => {
        const next = { ...prev, [id]: { ...prev[id], ...patch } };
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const applyPreset = useCallback(
    (key: string) => {
      const p = presets.find((x) => x.key === key);
      if (!p) return;
      setPreset(key);
      setZoomed(null);
      setLayout(() => {
        // 保留用户已移除/锁定状态？预设切换视为整体重排（与参考站行为一致）
        persist(p.layout);
        return JSON.parse(JSON.stringify(p.layout)) as GridLayout;
      });
    },
    [presets, persist]
  );

  const reset = useCallback(() => {
    const p = presets.find((x) => x.key === defaultKey);
    if (!p) return;
    setPreset(defaultKey);
    setZoomed(null);
    setLayout(() => {
      persist(p.layout);
      return JSON.parse(JSON.stringify(p.layout)) as GridLayout;
    });
  }, [presets, defaultKey, persist]);

  const toggleEdit = useCallback(() => setEditing((v) => !v), []);

  const moveMobile = useCallback(
    (id: string, dir: -1 | 1) => {
      setLayout((prev) => {
        const order = Object.entries(prev)
          .filter(([, it]) => it.visible !== false)
          .sort((a, b) => (a[1].mobileOrder ?? 0) - (b[1].mobileOrder ?? 0));
        const idx = order.findIndex(([k]) => k === id);
        const swapWith = order[idx + dir];
        if (!swapWith) return prev;
        const cur = prev[id].mobileOrder ?? idx;
        const other = prev[swapWith[0]].mobileOrder ?? idx + dir;
        const next = {
          ...prev,
          [id]: { ...prev[id], mobileOrder: other },
          [swapWith[0]]: { ...prev[swapWith[0]], mobileOrder: cur },
        };
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const removedIds = useMemo(
    () => Object.keys(layout).filter((id) => layout[id]?.visible === false),
    [layout]
  );

  /** 桌面像素几何（由容器宽度驱动） */
  const geometry = useCallback(
    (it: GridItem, containerW: number) => {
      const colW = (containerW - GAP * (COLS + 1)) / COLS;
      return {
        left: GAP + it.x * (colW + GAP),
        top: GAP + it.y * (ROWH + GAP),
        width: it.w * colW + (it.w - 1) * GAP,
        height: it.h * ROWH + (it.h - 1) * GAP,
      };
    },
    []
  );

  return {
    layout,
    editing,
    zoomed,
    focused,
    preset,
    removedIds,
    setEditing,
    setZoomed,
    setFocused,
    toggleEdit,
    update,
    applyPreset,
    reset,
    moveMobile,
    geometry,
  };
}
