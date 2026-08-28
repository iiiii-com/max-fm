import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import Breadcrumbs from "@/components/layout/Breadcrumbs";
import { RefreshProvider } from "@/lib/hooks/refresh";
import { ThemeProvider } from "@/components/theme-provider";
import { getSession } from "@/lib/auth";
import { Analytics } from "@vercel/analytics/next";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Max 财经数据平台", template: "%s | Max 财经数据平台" },
  description: "AI 驱动的全方位财经数据分析平台：政策解读、宏观经济、投资分析、中国经济分布图、产业链分析、个人理财建议。",
};

/** 移动端视口配置：viewport-fit=cover 支持刘海屏安全区；maximumScale=1 防止表单聚焦自动缩放 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f7f5" },
    { media: "(prefers-color-scheme: dark)", color: "#101014" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getSession();
  return (
    <html lang="zh-CN" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('max-theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground overflow-x-clip">
        <ThemeProvider>
          <RefreshProvider>
            <Header user={user} />
            <main className="flex-1">
              <Breadcrumbs />
              {children}
            </main>
            <Footer />
          </RefreshProvider>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}