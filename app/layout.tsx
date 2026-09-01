import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Geist, Geist_Mono, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import Breadcrumbs from "@/components/layout/Breadcrumbs";
import ShellChrome from "@/components/layout/ShellChrome";
import { RefreshProvider } from "@/lib/hooks/refresh";
import { ThemeProvider } from "@/components/theme-provider";
import { getSession } from "@/lib/auth";

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
  return (
    <html lang="zh-CN" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} ${ibmPlexMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-foreground overflow-x-clip">
        {/* 主题初始化：next/script beforeInteractive 输出到 head，防首屏闪烁且不触发 React 组件内 script 警告 */}
        <Script id="theme-init" strategy="beforeInteractive">
          {`try{var t=localStorage.getItem('max-theme');if(t!=='light')document.documentElement.classList.add('dark')}catch(e){}`}
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
          </RefreshProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}