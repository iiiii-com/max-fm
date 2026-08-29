import type { MetadataRoute } from "next";
import { SITE_URL } from "./sitemap";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // 登录/注册/账户等私人页面不收录
      disallow: ["/login", "/register", "/account", "/api/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
