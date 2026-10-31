import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Geist, Geist_Mono, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import Breadcrumbs from "@/components/layout/Breadcrumbs";
import ShellChrome from "@/components/layout/ShellChrome";
import InstallPrompt from "@/components/layout/InstallPrompt";
import { RefreshProvider } from "@/lib/hooks/refresh";
import { ThemeProvider } from "@/components/theme-provider";
import { getSession } from "@/lib/auth";
import { isDbDegraded } from "@/lib/db";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
/* K线实验室终端字体（复刻 GMT 终端视觉；数字表格 + 中文回退系统黑体） */
const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Max 财经数据平台", template: "%s | Max 财经数据平台" },
  description: "AI 驱动的全方位财经数据分析平台：政策解读、宏观经济、投资分析、中国经济分布图、产业链分析、个人理财建议。",
  manifest: "/manifest.webmanifest",
  /**
   * iOS 不读 manifest 的 display，必须靠这些 apple-* 元信息才能"添加到主屏幕"后
   * 以独立窗口打开。statusBarStyle 用 default（黑字）而不是 black-translucent：
   * 后者会让内容顶到状态栏下面，与站点的 safe-top 内边距叠在一起。
   */
  appleWebApp: {
    capable: true,
    title: "Max 财经",
    statusBarStyle: "default",
  },
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  /**
   * Next 16 的 appleWebApp.capable 只输出 apple-mobile-web-app-title 与
   * -status-bar-style，**不输出 apple-mobile-web-app-capable** —— 而正是这一条
   * 决定 iOS 从主屏打开时是否以独立窗口运行（缺了它仍会带 Safari 地址栏，
   * 等于装了个网页快捷方式而不是 App）。所以手动补上。
   * 同时不再重复声明 mobile-web-app-capable：那一条 appleWebApp.capable 已经输出。
   */
  other: { "apple-mobile-web-app-capable": "yes" },
};

/** 移动端视口配置：viewport-fit=cover 支持刘海屏安全区；不禁用用户缩放（WCAG 1.4.4），
 *  iOS 聚焦自动缩放改由全局 CSS 保证表单控件字号 ≥16px 解决 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#050505" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getSession();
  /**
   * 数据库降级时的全局横幅。
   * 生产事故背景：Neon 配额耗尽后每一次查询都失败，此前所有依赖数据库的页面直接变成
   * 「页面出了点问题」整页错误；降级后页面照常渲染（数据为空/缓存），但必须让用户
   * 明确知道「这不是我们的真实数据为空，而是数据服务暂时不可用」，否则会被误读成
   * 「宏观指标全为 0」。写入类操作仍会失败并给出错误，见 lib/db/index.ts 的处理原则。
   */
  const dbDegraded = isDbDegraded();
  return (
    <html lang="zh-CN" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} ${ibmPlexMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-foreground overflow-x-clip">
        {dbDegraded && (
          <div
            role="status"
            className="bg-amber-500/12 border-b border-amber-500/35 text-amber-800 dark:text-amber-200 text-xs leading-relaxed px-4 py-2 text-center"
          >
            ⚠ 数据服务暂时不可用（数据库配额超限），当前展示的是空数据或最近缓存；行情、指标与保存类操作暂停，恢复后自动生效。
          </div>
        )}
        {/* 主题初始化：next/script beforeInteractive 输出到 head，防首屏闪烁且不触发 React 组件内 script 警告。
            默认浅色（机构研究）；只有用户显式存了 dark 才加 .dark。 */}
        <Script id="theme-init" strategy="beforeInteractive">
          {`try{if(localStorage.getItem('max-theme')==='dark')document.documentElement.classList.add('dark')}catch(e){}`}
        </Script>
        {/* 无障碍：键盘用户可跳过导航直达主内容 */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 focus:px-3 focus:py-1.5 focus:rounded-md focus:bg-primary focus:text-white focus:text-sm"
        >
          跳转到主内容
        </a>
        <ThemeProvider>
          <RefreshProvider>
            <ShellChrome header={<Header user={user} />} breadcrumbs={<Breadcrumbs />} footer={<Footer />}>
              {children}
            </ShellChrome>
            <InstallPrompt />
          </RefreshProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}