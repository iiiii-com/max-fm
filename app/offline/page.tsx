import { redirect } from "next/navigation";

export const metadata = { title: "离线 | Max 财经" };

/**
 * 离线回退页（旧路由，保留兼容）。
 *
 * v2 的 Service Worker 曾把本路由的 HTML 预缓存成断网兜底页，但它依赖
 * /_next/static 的 JS/CSS chunk —— 用户若从未在线打开过 /offline，
 * 断网时这些 chunk 并不在缓存里，页面渲染出来就是白板。
 *
 * v3 起统一改用 `public/offline.html`（自包含、内联样式与脚本、安装时预缓存）：
 * 它在第一次断网时就能显示「核心指数 / 市场宽度 / 板块资金流 / 财经快讯」的
 * 上次在线快照，并标注缓存时间、自动重试、恢复后自动返回在线页面。
 *
 * 因此本路由只做一次重定向，避免出现两套离线文案各说各话。
 */
export default function OfflinePage(): never {
  redirect("/offline.html");
}
