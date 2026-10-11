/* eslint-disable no-undef */
/**
 * Max 财经 Service Worker
 *
 * 缓存策略只做三件事，每一条都对应一个明确的取舍：
 *
 * 1) /_next/static/ → **cache-first**
 *    这些文件名带内容哈希，内容永不变。缓存它们没有过期风险，
 *    且离线时仍能拿到外壳与脚本。
 *
 * 2) 页面导航 → **network-first**，离线时回落到缓存页，再回落离线页
 *    页面必须尽量新：站点数据是动态的，cache-first 会让用户看到隔夜行情。
 *
 * 3) /api/ → **一律不缓存**（network-only，失败直接失败）
 *    这是本文件最重要的一条。行情/估值/资金流一旦被缓存，
 *    用户看到的可能是昨天的价格却以为是实时 —— 对财经站来说，
 *    过期数据比没有数据危险得多。宁可让请求失败并显示"数据源不可用"。
 *
 * 另外：跨域请求一律绕过 SW（地图瓦片、字体等交给浏览器默认缓存策略）。
 *
 * 更新策略：skipWaiting + clients.claim，新版 SW 立刻接管，
 * 否则用户会被旧 SW 长期钉住（改完 bug 用户还是看到老页面，最难排查的一类问题）。
 */

const VERSION = "v1";
const STATIC_CACHE = `max-static-${VERSION}`;
const PAGE_CACHE = `max-page-${VERSION}`;
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(PAGE_CACHE);
      // 预缓存离线页：断网时导航回落到它
      try {
        await cache.add(new Request(OFFLINE_URL, { cache: "reload" }));
      } catch {
        /* 离线页拉不到也不阻塞安装 */
      }
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // 清掉旧版本缓存，避免磁盘被历史版本占满
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k !== STATIC_CACHE && k !== PAGE_CACHE).map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // 只处理 GET；POST/PUT 等一律直连（本站有登录、自选股写入等）
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // 跨域：交给浏览器，不介入
  if (url.origin !== self.location.origin) return;

  // API：绝不缓存。过期行情比没有行情更危险。
  if (url.pathname.startsWith("/api/")) return;

  // 构建产物：内容哈希，可永久缓存
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(STATIC_CACHE);
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        // 只缓存成功响应，避免把 404/500 固化下来
        if (res.ok) cache.put(req, res.clone());
        return res;
      })()
    );
    return;
  }

  // 页面导航：先网络，失败回落缓存页，再回落离线页
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(req);
          if (res.ok) {
            const cache = await caches.open(PAGE_CACHE);
            cache.put(req, res.clone());
          }
          return res;
        } catch {
          const cache = await caches.open(PAGE_CACHE);
          const hit = await cache.match(req);
          if (hit) return hit;
          const offline = await cache.match(OFFLINE_URL);
          if (offline) return offline;
          return new Response("离线，且该页面未缓存", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          });
        }
      })()
    );
  }
});