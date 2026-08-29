import type { MetadataRoute } from "next";

// 站点根地址：优先取环境变量 NEXT_PUBLIC_SITE_URL，部署后可在 Vercel 项目环境变量中配置正式域名
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://max-fm.vercel.app";

const STATIC_ROUTES: { path: string; priority: number; changeFrequency: "hourly" | "daily" | "weekly" | "monthly" }[] = [
  { path: "/", priority: 1, changeFrequency: "hourly" },
  { path: "/market", priority: 0.9, changeFrequency: "daily" },
  { path: "/sector", priority: 0.9, changeFrequency: "daily" },
  { path: "/macro", priority: 0.8, changeFrequency: "daily" },
  { path: "/analysis/bullbear", priority: 0.8, changeFrequency: "weekly" },
  { path: "/history", priority: 0.8, changeFrequency: "weekly" },
  { path: "/map", priority: 0.7, changeFrequency: "monthly" },
  { path: "/industry", priority: 0.7, changeFrequency: "weekly" },
  { path: "/compare", priority: 0.6, changeFrequency: "weekly" },
  { path: "/etf", priority: 0.6, changeFrequency: "daily" },
  { path: "/advice", priority: 0.5, changeFrequency: "weekly" },
  { path: "/policy", priority: 0.5, changeFrequency: "weekly" },
  { path: "/about", priority: 0.3, changeFrequency: "monthly" },
  { path: "/disclaimer", priority: 0.2, changeFrequency: "monthly" },
  { path: "/privacy", priority: 0.2, changeFrequency: "monthly" },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return STATIC_ROUTES.map((r) => ({
    url: `${SITE_URL}${r.path}`,
    lastModified,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));
}
