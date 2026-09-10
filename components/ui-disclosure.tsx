"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * 移动端折叠容器：长表格 / 长列表在窄屏默认收起，桌面端始终完整展示。
 *
 * 背景：移动端页面高度普遍是桌面的近 2 倍（市场洞察 17399px vs 桌面 9135px），
 * 经逐块测量，主要高度来自几张长表格（历史危机表 3205px、板块资金流 2030px 等）。
 * 这些内容在移动端一次性铺开会让用户长时间滚动才能到达下一个主题。
 *
 * 实现要点：
 *   - 初始 `open=false`（服务端与客户端一致），避免水合不一致；
 *   - 收起态用 `max-h + overflow-hidden`，并由 `md:max-h-none` 在桌面端直接失效，
 *     因此桌面端视觉与交互完全不变，无需 JS 判断视口；
 *   - 底部渐隐遮罩同样仅在移动端显示（`md:hidden`），提示「下面还有内容」；
 *   - 按钮带 aria-expanded / aria-controls，保证读屏可感知展开状态。
 */
export function CollapsibleOnMobile({
  children,
  /** 收起时保留的高度（px），默认 420 */
  collapsedHeight = 420,
  /** 展开/收起的按钮文案 */
  moreLabel = "展开全部",
  lessLabel = "收起",
  className,
}: {
  children: ReactNode;
  collapsedHeight?: number;
  moreLabel?: string;
  lessLabel?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className={className}>
      <div
        id="collapsible-body"
        className={cn("relative", !open && "overflow-hidden md:!max-h-none")}
        style={!open ? { maxHeight: collapsedHeight } : undefined}
      >
        {children}
        {!open && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-card to-transparent md:hidden"
          />
        )}
      </div>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="collapsible-body"
        className="mt-2 flex w-full items-center justify-center gap-1 rounded-md border border-border py-1.5 text-[11px] text-muted transition-colors hover:border-primary/50 hover:text-primary md:hidden"
      >
        {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        {open ? lessLabel : moreLabel}
      </button>
    </div>
  );
}
