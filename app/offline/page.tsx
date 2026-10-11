import Link from "next/link";

export const metadata = { title: "离线 | Max 财经" };

/**
 * 离线回退页。
 *
 * 只在「导航请求失败且该页面没有缓存」时由 Service Worker 返回，
 * 所以文案要解释清楚发生了什么，而不是甩一句"网络错误"。
 * 说明两件用户真正关心的事：数据没被缓存是刻意的（行情不能给旧的），
 * 以及恢复后刷新即可。
 */
export default function OfflinePage() {
  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center">
      <div className="mx-auto w-12 h-12 rounded-md bg-gradient-to-br from-[#d4203d] to-[#111] text-white font-black text-xl flex items-center justify-center mb-5">
        M
      </div>
      <h1 className="text-xl font-bold mb-3">当前处于离线状态</h1>
      <p className="text-sm text-muted leading-relaxed">
        这个页面没有缓存，所以断网时打不开。
      </p>
      <p className="text-xs text-muted leading-relaxed mt-4 border-t border-border pt-4">
        行情与估值数据<b className="text-foreground">不会</b>被离线缓存 —— 这是刻意的：
        让你看到昨天的价格却以为是实时的，比看不到更危险。
        恢复网络后刷新即可。
      </p>
      <Link
        href="/"
        className="inline-block mt-6 px-4 py-2 rounded-md border border-border text-sm hover:border-primary/50"
      >
        重试首页
      </Link>
    </div>
  );
}