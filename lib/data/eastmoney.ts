/**
 * 东方财富公开接口的公共参数与口径工具。
 *
 * 为什么单独成文件：
 *  1) `ut` 是 push2 系列接口的"应用令牌"。缺少它时多数请求仍能返回数据，
 *     但**部分字段（尤其是 f62 主力净流入）在非交易时段会退化成字符串 "-"**，
 *     不同接口表现还不一致。历史上前端 `toFixed` 崩溃就是从这里来的。
 *     统一带上，避免每个调用点各写一遍、写一半漏一半。
 *  2) secid 的市场前缀（1=沪 / 0=深与北）到处都要用，而且历史 bug 是
 *     "深市股票被硬编码成 1. 前缀导致跳错标的"。集中成一个函数，便于审。
 */

/** push2 应用令牌（东财网页端公开使用，非密钥） */
export const EM_UT = "b2884a393a59ad64002292a3e90d46a5";

/** 行情类接口通用请求头（缺 UA/Referer 时上游可能返回空 body） */
export const EM_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
  Referer: "https://quote.eastmoney.com/",
} as const;

/**
 * 6 位股票代码 → 东财 secid。
 * 规则：沪市（60/68/质地 6 开头）→ 1.；深市（00/30）与北交所（4/8/9）→ 0.。
 * 注意：ETF/LOF 的 5 开头属沪市，1 开头（159xxx）属深市，不能只看首位数字。
 */
export function stockSecid(code: string): string {
  const c = String(code || "").trim();
  if (!/^\d{6}$/.test(c)) return `1.${c}`;
  if (/^(6|5|9)/.test(c)) return `1.${c}`;
  return `0.${c}`;
}

/* ------------------------------------------------------------------ *
 * 全局限流 + 重试的东财 JSON 请求
 *
 * 实测（2026-10-29，本机直连）：对 push2.eastmoney.com 并发 8/20/40 个请求，
 * **全部**以 `UND_ERR_SOCKET: other side closed` 失败；同样请求串行则 100% 成功。
 * 也就是说上游按并发连接数掐断，而不是限频或参数问题。
 *
 * 站点一个页面会同时打十几个东财接口（指数快照 + 资金流 + 涨跌家数 + K线…），
 * 于是经常整批失败 —— 用户看到的就是「有时没有数据 / ETF 显示不出来 / 资金流空白」，
 * 而底层代码并没有 bug。历史修复只在前端加提示，治不了根。
 *
 * 这里做两件事：
 *  1) 进程内信号量把对东财的**并发**压到 2 条以内（超过的排队，不失败）；
 *  2) 失败重试 1 次（250ms 退避），覆盖偶发的连接重置。
 * 排队只影响突发场景的等待时间，不改变任何数据口径。
 * ------------------------------------------------------------------ */
const EM_MAX_CONCURRENT = 2;
let emActive = 0;
const emWaiters: Array<() => void> = [];

async function emAcquire(): Promise<void> {
  if (emActive < EM_MAX_CONCURRENT) {
    emActive += 1;
    return;
  }
  await new Promise<void>((resolve) => emWaiters.push(resolve));
  emActive += 1;
}

function emRelease(): void {
  emActive -= 1;
  const next = emWaiters.shift();
  if (next) next();
}

/**
 * 请求东财 JSON。任何失败都返回 null，由调用方决定降级文案（不得以 0 冒充缺失）。
 * 只用于 push2/quote 这类公开行情接口；需要其它 headers 的站点请自行 fetch。
 */
export async function emJson<T = any>(
  url: string,
  opts: { timeoutMs?: number; retries?: number; headers?: Record<string, string> } = {}
): Promise<T | null> {
  const timeoutMs = opts.timeoutMs ?? 9000;
  const retries = opts.retries ?? 1;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    await emAcquire();
    try {
      const res = await fetch(url, {
        headers: { ...EM_HEADERS, ...(opts.headers ?? {}) },
        signal: AbortSignal.timeout(timeoutMs),
        cache: "no-store",
      });
      if (!res.ok) continue;
      return (await res.json()) as T;
    } catch {
      // 连接被上游重置（UND_ERR_SOCKET）时退避后重试一次
      if (attempt < retries) await new Promise((r) => setTimeout(r, 250));
    } finally {
      emRelease();
    }
  }
  return null;
}