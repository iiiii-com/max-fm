/* eslint-disable no-undef */
/**
 * Max 财经 Service Worker
 *
 * 策略分四档，每档对应一个明确取舍：
 *
 * 1) /_next/static/、/icons/ 等静态资源 → **cache-first**
 *    文件名带内容哈希，内容永不变；缓存它们没有过期风险，离线时仍能拿到外壳与脚本。
 *
 * 2) 只读行情接口白名单（见 API_SNAPSHOT_PATHS）→ **network-first + 快照回放**
 *    在线时永远拿最新（金融站的第一原则）；断网时回放「上次成功拉取的那一份」，
 *    并在响应头写 `X-Offline-Cache: 1` + `X-Cached-At`，页面据此如实显示
 *    「缓存于 HH:MM:SS」。快照超过 6 小时不再回放 —— 隔夜数据回放等于谎报实时。
 *
 * 3) 其余 /api/**（登录、自选、提交、导出、AI…）→ **不拦截、不缓存**
 *
 * 4) 页面导航 → **network-only**，失败落自包含的 /offline.html
 *    **不缓存整页 HTML**：站点页面普遍带登录态与实时价格，回放旧 HTML 会让用户
 *    看到上一个账号的用户名与隔夜价格，且没有任何"这是缓存"的提示。
 *
 * 离线页用 public/offline.html 而不是 /offline 这个 Next 路由：后者依赖
 * /_next/static 的 JS/CSS chunk，用户若从未在线打开过它，断网时这些 chunk 不存在，
 * 页面渲染出来是白板。offline.html 内联全部样式与脚本，安装时预缓存，第一次断网就能用。
 *
 * 更新策略：skipWaiting + clients.claim。否则用户会被旧版 SW 长期钉住
 * （改完 bug 用户还是看到老页面，是最难排查的一类问题）。
 */

// v3：新增只读接口快照回放 + 自包含离线页；activate 会清掉 v1/v2 的 max-* 旧缓存。
const VERSION = "v3";
const STATIC_CACHE = `max-static-${VERSION}`;
const API_CACHE = `max-api-${VERSION}`;
const OFFLINE_URL = "/offline.html";

/** 允许离线回放的只读接口（仅 GET）。按 pathname 精确/前缀匹配。 */
const API_SNAPSHOT_PATHS = [
  "/api/quotes",
  "/api/market/breadth",
  "/api/market/fund-rank",
  "/api/market/surge",
  "/api/sector/board",
  "/api/sector/sentiment",
  "/api/northbound",
  "/api/news/flash",
  "/api/global/heatmap",
  "/api/macro/context",
  "/api/macro/monthly",
  "/api/macro/indicators",
  "/api/etf/list",
  "/api/etf/activity",
];

/** 快照保鲜期：超过 6 小时不再回放（宁可显示无数据，也不给隔夜价格）。 */
const SNAPSHOT_TTL_MS = 6 * 60 * 60 * 1000;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      // 预缓存自包含离线页：断网时导航回落到它
      try {
        await cache.add(new Request(OFFLINE_URL, { cache: "reload" }));
      } catch {
        /* 部署瞬间 404 也不阻塞安装，下次导航会重新尝试 */
      }
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // 清掉旧版本缓存（v1 的 max-page-v1、v2 的 max-page-v2 等），避免磁盘被历史版本占满
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith("max-") && k !== STATIC_CACHE && k !== API_CACHE)
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

function isApiSnapshot(url) {
  if (url.origin !== self.location.origin) return false;
  return API_SNAPSHOT_PATHS.some((p) => url.pathname === p || url.pathname.startsWith(p + "/"));
}

function isStaticAsset(url) {
  if (url.origin !== self.location.origin) return false;
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.webmanifest" ||
    url.pathname === "/favicon.ico"
  );
}

function offlineUnavailable(message) {
  return new Response(JSON.stringify({ ok: false, offline: true, error: message }), {
    status: 503,
    headers: { "Content-Type": "application/json; charset=utf-8", "X-Offline-Cache": "0" },
  });
}

/** 网络优先；失败回放快照。快照以 `{cachedAt, body}` 包一层，回放时还原原始 JSON。 */
async function apiNetworkFirst(request) {
  const cache = await caches.open(API_CACHE);
  const key = new Request(request.url, { method: "GET" });
  try {
    const res = await fetch(request);
    if (res && res.ok) {
      try {
        const text = await res.clone().text();
        await cache.put(
          key,
          new Response(JSON.stringify({ cachedAt: Date.now(), body: text }), {
            headers: { "Content-Type": "application/json; charset=utf-8" },
          }),
        );
      } catch {
        /* 缓存失败不影响本次响应 */
      }
    }
    return res;
  } catch {
    const hit = await cache.match(key);
    if (!hit) return offlineUnavailable("离线，且本机没有这份数据的快照");
    try {
      const { cachedAt, body } = await hit.json();
      if (!cachedAt || Date.now() - cachedAt > SNAPSHOT_TTL_MS) {
        return offlineUnavailable("离线快照已超过 6 小时，不再回放");
      }
      return new Response(body, {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "X-Offline-Cache": "1",
          "X-Cached-At": new Date(cachedAt).toISOString(),
          "Cache-Control": "no-store",
        },
      });
    } catch {
      return offlineUnavailable("离线快照读取失败");
    }
  }
}

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // 只处理 GET；POST/PUT 等一律直连（本站有登录、自选股写入等）
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // 跨域：交给浏览器（地图瓦片、字体等），不介入
  if (url.origin !== self.location.origin) return;

  // 1) 静态资源：cache-first
  if (isStaticAsset(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(STATIC_CACHE);
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        // 只缓存成功响应，避免把 404/500 固化下来
        if (res.ok) cache.put(req, res.clone()).catch(() => {});
        return res;
      })(),
    );
    return;
  }

  // 2) 只读行情接口：network-first + 快照回放
  if (isApiSnapshot(url)) {
    event.respondWith(apiNetworkFirst(req));
    return;
  }

  // 3) 其余 /api/**：不拦截、不缓存（登录态、写入、导出、AI 等）
  if (url.pathname.startsWith("/api/")) return;

  // 4) 页面导航：network-only，失败落离线快照页
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          return await fetch(req);
        } catch {
          const cache = await caches.open(STATIC_CACHE);
          const offline = await cache.match(OFFLINE_URL);
          if (offline) return offline;
          return new Response(
            "<!doctype html><meta charset='utf-8'><title>网络不可用</title>" +
              "<body style='background:#050505;color:#e8e8ea;font-family:system-ui;padding:40px;line-height:1.7'>" +
              "<h1 style='font-size:18px'>网络不可用</h1>" +
              "<p style='color:#8a8a93;font-size:13px'>离线页尚未缓存成功，请联网后重新打开一次本站。</p></body>",
            { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } },
          );
        }
      })(),
    );
  }
});
