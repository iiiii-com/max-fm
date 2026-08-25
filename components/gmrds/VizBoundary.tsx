"use client";

import { Component, type ReactNode } from "react";

interface State {
  error: Error | null;
}

/**
 * 可视化组件错误边界：单个图表崩溃不白屏整页，显示降级提示
 */
export default class VizBoundary extends Component<{ children: ReactNode; name?: string }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error(`[VizBoundary] ${this.props.name ?? "组件"} 渲染失败:`, error);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          <b>「{this.props.name ?? "可视化组件"}」渲染失败</b>
          <p className="text-xs mt-1 break-all">{this.state.error.message}</p>
          <p className="text-[10px] mt-1 text-red-400">错误已隔离，不影响页面其它内容；请将上方错误信息反馈以便修复。</p>
        </div>
      );
    }
    return this.props.children;
  }
}
