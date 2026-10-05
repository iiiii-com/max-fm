import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Noto_Serif_SC } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

// 中文标题走开源宋体，与 Geist 的几何无衬线拉开气质。
// next/font 在构建期下载并自托管，运行时无第三方 CDN。
// CJK 字体在 Google Fonts 上没有 latin/cyrillic 那套 subset 划分，故不传 subsets。
const serifCn = Noto_Serif_SC({
  variable: "--font-serif-cn",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "效率工作台",
    template: "%s · 效率工作台",
  },
  description: "个人工作效率管理系统：任务、考勤、工时与数据可视化",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfcfd" },
    { media: "(prefers-color-scheme: dark)", color: "#101319" },
  ],
};

// 仪器默认深色：只有显式选过浅色才回到浅色
const THEME_INIT = `(function(){try{if(localStorage.getItem("max-theme")!=="light"){document.documentElement.classList.add("dark")}}catch(e){}})()`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${serifCn.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
