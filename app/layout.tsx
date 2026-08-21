import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import Breadcrumbs from "@/components/layout/Breadcrumbs";
import { RefreshProvider } from "@/lib/hooks/refresh";
import { ThemeProvider } from "@/components/theme-provider";
import { getSession } from "@/lib/auth";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Max 财经数据平台", template: "%s | Max 财经数据平台" },
  description: "AI 驱动的全方位财经数据分析平台：政策解读、宏观经济、投资分析、中国经济分布图、产业链分析、个人理财建议。",
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
      <body className="min-h-full flex flex-col bg-background text-foreground">
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
      </body>
    </html>
  );
}