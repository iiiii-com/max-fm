import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { desc } from "drizzle-orm";

// 站点根地址：优先取环境变量 NEXT_PUBLIC_SITE_URL，部署后可在 Vercel 项目环境变量中配置正式域名
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://max-fm.vercel.app";

/**
 * 静态路由清单。
 *
 * 修复：旧 sitemap 只有 15 条，而站点实际有 60+ 可索引页面 ——
 * /lab、/stock、/search、/article/*、/policy/*、/history/*、/industry/*、
 * /gmrds/*、/analysis/cycle-anatomy、/macro/feeling 等全部缺失，
 * 搜索引擎无法发现这些内容页。
 * 现补齐全部稳定路由，并额外输出内容型动态路由（文章 / 政策 / 产业链 / 历史事件）。
 */
const STATIC_ROUTES: {
  path: string;
  priority: number;
  changeFrequency: "hourly" | "daily" | "weekly" | "monthly" | "yearly";
}[] = [
  { path: "/", priority: 1, changeFrequency: "hourly" },

  // 市场
  { path: "/market", priority: 0.9, changeFrequency: "daily" },
  { path: "/market?tab=stocks", priority: 0.8, changeFrequency: "daily" },
  { path: "/market?tab=etf", priority: 0.8, changeFrequency: "daily" },
  { path: "/sector", priority: 0.9, changeFrequency: "daily" },
  { path: "/compare", priority: 0.6, changeFrequency: "weekly" },
  { path: "/stock", priority: 0.7, changeFrequency: "daily" },

  // 宏观
  { path: "/macro", priority: 0.8, changeFrequency: "daily" },
  { path: "/macro/feeling", priority: 0.6, changeFrequency: "weekly" },
  { path: "/policy", priority: 0.6, changeFrequency: "daily" },
  { path: "/map", priority: 0.7, changeFrequency: "monthly" },
  { path: "/advice", priority: 0.5, changeFrequency: "weekly" },

  // 产业 / 历史 / 周期
  { path: "/industry", priority: 0.7, changeFrequency: "weekly" },
  { path: "/history", priority: 0.8, changeFrequency: "weekly" },
  { path: "/cycle", priority: 0.7, changeFrequency: "weekly" },
  { path: "/analysis/bullbear", priority: 0.8, changeFrequency: "weekly" },
  { path: "/analysis/cycle-anatomy", priority: 0.7, changeFrequency: "weekly" },

  // 研究体系
  { path: "/gmrds", priority: 0.7, changeFrequency: "weekly" },
  { path: "/gmrds/flow", priority: 0.6, changeFrequency: "monthly" },
  { path: "/gmrds/depth", priority: 0.6, changeFrequency: "monthly" },
  { path: "/gmrds/toolkit", priority: 0.6, changeFrequency: "monthly" },
  { path: "/gmrds/cases", priority: 0.6, changeFrequency: "monthly" },
  { path: "/gmrds/case", priority: 0.5, changeFrequency: "monthly" },
  { path: "/gmrds/scorecard", priority: 0.5, changeFrequency: "monthly" },
  { path: "/gmrds/governance", priority: 0.5, changeFrequency: "monthly" },
  { path: "/gmrds/data-platform", priority: 0.5, changeFrequency: "monthly" },
  { path: "/gmrds/implementation", priority: 0.5, changeFrequency: "monthly" },
  { path: "/gmrds/roadmap", priority: 0.4, changeFrequency: "monthly" },
  { path: "/gmrds/sources", priority: 0.4, changeFrequency: "monthly" },

  // 工具
  { path: "/lab", priority: 0.6, changeFrequency: "daily" },
  { path: "/search", priority: 0.4, changeFrequency: "weekly" },

  // 法务 / 关于（低频，不该排在前面）
  { path: "/about", priority: 0.3, changeFrequency: "monthly" },
  { path: "/disclaimer", priority: 0.2, changeFrequency: "monthly" },
  { path: "/privacy", priority: 0.2, changeFrequency: "monthly" },
];

/** 需登录 / 不应被索引的路径（不在 sitemap 中出现） */
const EXCLUDED = new Set(["/login", "/register", "/account"]);

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const lastModified = new Date();
  const out: MetadataRoute.Sitemap = STATIC_ROUTES.filter((r) => !EXCLUDED.has(r.path)).map((r) => ({
    url: `${SITE_URL}${r.path}`,
    lastModified,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));

  // 动态内容页：政策 / 文章 / 历史事件 / 产业链
  try {
    const [policies, articles, events, chains] = await Promise.all([
      db.select({ id: s.policies.id, updatedAt: s.policies.updatedAt, publishDate: s.policies.publishDate }).from(s.policies),
      db.select({ slug: s.articles.slug, updatedAt: s.articles.updatedAt, publishDate: s.articles.publishDate }).from(s.articles),
      db.select({ slug: s.historyEvents.slug }).from(s.historyEvents),
      db.select({ slug: s.industryChains.slug }).from(s.industryChains),
    ]);

    const toDate = (v: unknown) => {
      const n = Number(v);
      if (Number.isFinite(n) && n > 0) return new Date(n < 1e11 ? n * 1000 : n);
      const d = v ? new Date(String(v)) : null;
      return d && !Number.isNaN(d.getTime()) ? d : lastModified;
    };

    for (const p of policies as any[]) {
      out.push({
        url: `${SITE_URL}/policy/${p.id}`,
        lastModified: toDate(p.updatedAt ?? p.publishDate),
        changeFrequency: "monthly",
        priority: 0.4,
      });
    }
    for (const a of articles as any[]) {
      if (!a?.slug) continue;
      out.push({
        url: `${SITE_URL}/article/${a.slug}`,
        lastModified: toDate(a.updatedAt ?? a.publishDate),
        changeFrequency: "monthly",
        priority: 0.5,
      });
    }
    for (const e of events as any[]) {
      if (!e?.slug) continue;
      out.push({
        url: `${SITE_URL}/history/${e.slug}`,
        lastModified,
        changeFrequency: "yearly",
        priority: 0.3,
      });
    }
    for (const c of chains as any[]) {
      if (!c?.slug) continue;
      out.push({
        url: `${SITE_URL}/industry/${c.slug}`,
        lastModified,
        changeFrequency: "monthly",
        priority: 0.4,
      });
    }
  } catch {
    // 数据库不可用时只输出静态路由，不让整份 sitemap 失败
  }

  return out;
}
