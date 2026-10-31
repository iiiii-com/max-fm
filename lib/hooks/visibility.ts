/**
 * 页面可见性工具。
 *
 * 后台标签页里 `setInterval` 仍会按原频率触发，只是浏览器节流到 1 次/分钟；
 * 但站点有 6 处每 30–60 秒打上游东财/新浪的轮询，切到后台后仍在持续消耗
 * 上游配额（并发一高就会成批被掐断，见 lib/data/eastmoney.ts）并产生无用请求。
 *
 * 用法：
 * - 轮询回调开头 `if (isPageHidden()) return;`
 * - 或 `setInterval(guardPoll(load), 60_000)`
 */
export function isPageHidden(): boolean {
  return typeof document !== "undefined" && document.visibilityState === "hidden";
}

/** 把轮询函数包一层：页面隐藏时跳过本轮（不排队、不累积） */
export function guardPoll(fn: () => unknown): () => void {
  return () => {
    if (isPageHidden()) return;
    void fn();
  };
}
