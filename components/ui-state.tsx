"use client";

import type { ReactNode } from "react";
import { AlertTriangle, Inbox, Loader2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * 全站统一的状态表达组件：加载 / 空 / 错误
 *
 * 背景：此前各组件自行拼装这三态 —— 统计下来 54 个含 fetch 的组件里
 * 25 个用纯文字「加载中…」、仅 14 个用骨架屏、18 个完全没有错误处理，
 * 导致同一种状态在不同页面呈现不一致（有的空白、有的文字、有的假死）。
 *
 * 统一约定（终端风格，与全站 --card / --border / --muted / --primary 令牌一致）：
 *   - 加载：优先骨架屏（保留布局尺寸，避免加载完成后的跳动 CLS）
 *   - 空：图标 + 一句话说明 + 可选的下一步操作，不能只是空白
 *   - 错误：role="alert" 保证读屏可感知，并提供「重试」出口
 */

/* ───────────────────────── 骨架屏 ───────────────────────── */

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-md bg-surface", className)} />;
}

/** 多行文本骨架：末行略短，更接近真实段落形态 */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)} aria-hidden>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn("h-3", i === lines - 1 ? "w-2/3" : "w-full")} />
      ))}
    </div>
  );
}

/** 图表骨架：等比占位，避免图表加载完成后页面高度突变 */
export function SkeletonChart({ height = 260, label, className }: { height?: number; label?: string; className?: string }) {
  return (
    <div
      className={cn("flex items-center justify-center rounded-lg border border-border/60 bg-card/40", className)}
      style={{ height }}
      role="status"
      aria-busy="true"
    >
      <div className="flex flex-col items-center gap-2 text-muted">
        <Skeleton className="h-1.5 w-24" />
        <Skeleton className="h-1.5 w-16" />
        <Skeleton className="h-1.5 w-20" />
        <span className="mt-1 text-[11px]">{label ?? "图表加载中…"}</span>
      </div>
    </div>
  );
}

/* ───────────────────────── 区域级三态容器 ───────────────────────── */

/**
 * 统一的加载态容器（用于列表/卡片区域）
 * @param rows 骨架行数
 */
export function LoadingRegion({ rows = 4, label, className }: { rows?: number; label?: string; className?: string }) {
  return (
    <div className={cn("space-y-2", className)} role="status" aria-busy="true" aria-label={label ?? "加载中"}>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-9 w-full" />
      ))}
      {label && <p className="text-[11px] text-muted">{label}</p>}
    </div>
  );
}

/** 统一的空状态：图标 + 标题 + 说明 + 可选操作 */
export function EmptyState({
  title = "暂无数据",
  hint,
  icon,
  action,
  className,
}: {
  title?: string;
  hint?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 py-10 text-center", className)}>
      <div className="text-muted/60">{icon ?? <Inbox className="h-7 w-7" />}</div>
      <p className="text-sm text-muted">{title}</p>
      {hint && <p className="max-w-md text-[11px] leading-relaxed text-muted/70">{hint}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

/**
 * 统一的错误态
 * role="alert" 让读屏在错误出现时立即播报；提供重试出口，避免用户只能刷新整页
 */
export function ErrorState({
  message = "加载失败",
  hint,
  onRetry,
  retrying = false,
  compact = false,
  className,
}: {
  message?: string;
  hint?: string;
  onRetry?: () => void;
  retrying?: boolean;
  /** compact：嵌入卡片内的窄条样式 */
  compact?: boolean;
  className?: string;
}) {
  if (compact) {
    return (
      <div
        role="alert"
        className={cn(
          "flex flex-wrap items-center gap-2 rounded-md border border-up/30 bg-up/8 px-2.5 py-1.5 text-[11px] text-up",
          className
        )}
      >
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
        <span className="min-w-0 flex-1">{message}</span>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            disabled={retrying}
            className="shrink-0 rounded border border-up/40 px-1.5 py-0.5 transition-colors hover:bg-up/15 disabled:opacity-50"
          >
            {retrying ? "重试中…" : "重试"}
          </button>
        )}
      </div>
    );
  }

  return (
    <div role="alert" className={cn("flex flex-col items-center justify-center gap-2 py-10 text-center", className)}>
      <AlertTriangle className="h-7 w-7 text-up/70" />
      <p className="text-sm text-up">{message}</p>
      {hint && <p className="max-w-md text-[11px] leading-relaxed text-muted">{hint}</p>}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          disabled={retrying}
          className="mt-1 inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-muted transition-colors hover:border-primary/50 hover:text-primary disabled:opacity-50"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", retrying && "animate-spin")} />
          {retrying ? "重试中…" : "重新加载"}
        </button>
      )}
    </div>
  );
}

/** 极简的「加载中」行内提示（用于原地刷新，不遮挡已有内容） */
export function InlineLoading({ label = "加载中…", className }: { label?: string; className?: string }) {
  return (
    <p className={cn("flex items-center gap-1.5 text-[11px] text-muted", className)} role="status" aria-busy="true">
      <Loader2 className="h-3 w-3 animate-spin" />
      {label}
    </p>
  );
}
