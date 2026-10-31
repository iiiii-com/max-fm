import type { NextConfig } from "next";

/**
 * 安全响应头（审计 A7：全站原无任何安全头，可被第三方站点 iframe 嵌套）。
 *
 * 这里只加「低风险、不会破坏现有页面」的几项：
 * - X-Content-Type-Options：禁止浏览器猜 MIME（防上传/接口响应被当脚本执行）
 * - Referrer-Policy：跨站只发源，避免把带查询参数的站内 URL 泄露给外链
 * - X-Frame-Options: SAMEORIGIN：禁止第三方 iframe 嵌套（点击劫持）
 * - Permissions-Policy：关闭本站未使用的敏感权限
 * - HSTS：仅生产环境、仅 HTTPS 生效，浏览器在 http 下会忽略
 *
 * 任务④：CSP 先上 **Report-Only 观察模式**，不拦截任何资源。
 * 为什么不能直接上强制 CSP：站点有 Next 内联脚本/预取脚本、ECharts 动态创建
 * canvas、地图瓦片、AI 结果 Markdown 渲染（可能带外链图片），逐条白名单没验证过
 * 就上 enforced 会直接白屏（尤其 AI 富文本与地图）。Report-Only 期间浏览器只在
 * 控制台上报、不阻断，收集到的违规经 /api/csp-report 汇总，再按数据把
 * 'unsafe-inline'/'unsafe-eval' 等放宽项逐条收紧，最后切 enforce。
 *
 * 说明：`report-uri` 是旧格式但兼容性最好；不带 `report-to` 是为了不依赖
 * `Reporting-Endpoints` 头在移动端 WebView 的支持差异（验证成本更高）。
 */
const cspReportOnly = [
  "default-src 'self'",
  // Next 会内联启动脚本与 chunk 加载器；ECharts 无 eval 需求，但 React 开发构建有，先放宽观察
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  // ECharts 需要内联 style，tailwind 输出为外链 css
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  // 行情/AI/新闻接口均为站内同源代理；外链仅作为兜底与地图瓦片
  "connect-src 'self' https:",
  "media-src 'self' data: https:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "frame-src 'self' https:",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
  "report-uri /api/csp-report",
].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "Content-Security-Policy-Report-Only", value: cspReportOnly },
];

const nextConfig: NextConfig = {
  // 原为 false：ECharts 在 StrictMode 双挂载下 dispose 与 React DOM 移除竞争，
  // 导致 removeChild NotFoundError → 页面 "This page couldn't load"。
  // 任务④已从根因修复（components/charts/echarts.ts 的 initResponsiveChart 会先
  // dispose 同一 DOM 上的旧实例），因此可以恢复 StrictMode，让开发期提前暴露
  // 重复挂载/副作用未清理问题。生产构建不受 StrictMode 影响。
  reactStrictMode: true,
  // C:\Users\lenovo 下有一个 package-lock.json，Next 会误以为仓库根在上一层，
  // 进而在 build 时告警并影响 output tracing。显式指定项目根消除歧义。
  outputFileTracingRoot: __dirname,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
