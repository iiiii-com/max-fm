import type { MetadataRoute } from "next";

/**
 * PWA manifest —— 手机与桌面的「安装」信息都来自这里。
 *
 * 一份 manifest 同时服务两端：
 *   Android / Chrome 桌面 / Edge 桌面：读 manifest 后提供「安装」入口，
 *     装完是独立窗口（display: standalone），不再有浏览器地址栏 —— 这就是"客户端"。
 *   iOS Safari：不读 manifest 的 display，靠 layout.tsx 里的 apple-* 元信息，
 *     需要用户手动「分享 → 添加到主屏幕」。
 *
 * shortcuts 是桌面右键菜单/长按图标弹出的快捷入口，指向站内高频页面。
 * 图标文件由 scripts/gen-icons.ts 生成，尺寸必须与那里一致。
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Max 财经数据平台",
    short_name: "Max 财经",
    description: "宏观、市场、产业、历史演进与量化研究一体化的财经数据平台",
    // 应用起始页用 /market（行情是最高频入口），而不是落地页
    start_url: "/market?utm_source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#ffffff",
    // 与站点 header 的主色一致，启动画面不会闪一下别的颜色
    theme_color: "#d4203d",
    lang: "zh-CN",
    dir: "ltr",
    categories: ["finance", "business", "news"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // maskable 单独一份：Android 会把图标裁成圆形，内容需落在中心安全区
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "大盘指数", short_name: "行情", url: "/market" },
      { name: "个股查询", short_name: "个股", url: "/stock" },
      { name: "产业地图", short_name: "产业", url: "/industry" },
      { name: "K线实验室", short_name: "实验室", url: "/lab" },
    ],
  };
}