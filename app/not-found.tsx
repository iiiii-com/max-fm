import Link from "next/link";

const HOT_LINKS = [
  { href: "/market", title: "市场洞察", desc: "大盘指数 · 个股 · ETF · 资金流" },
  { href: "/sector", title: "板块中心", desc: "板块行情 · 资金流向 · 热点" },
  { href: "/analysis/bullbear", title: "牛熊深度", desc: "历史重演 · 中美对比" },
  { href: "/history", title: "历史时间线", desc: "全球事件 · 牛熊周期 · 康波全景" },
  { href: "/map", title: "经济分布图", desc: "31 省 GDP · 人口 · 财政" },
  { href: "/industry", title: "产业链", desc: "22 条主线 · 上下游全景" },
];

export default function NotFound() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-16 text-center">
      <p className="font-mono text-7xl font-bold text-primary select-none">404</p>
      <h1 className="mt-4 text-xl font-bold">页面没有找到</h1>
      <p className="mt-2 text-sm text-muted leading-relaxed">
        您访问的地址可能已变更或不存在。可以从下方入口继续，或直接搜索股票、指数、ETF。
      </p>

      <form action="/search" method="get" className="mt-6 flex items-center gap-2 max-w-md mx-auto">
        <input
          type="search"
          name="q"
          placeholder="输入股票名称或代码，如：平安 / 601318"
          aria-label="搜索股票、指数、ETF"
          className="flex-1 h-10 px-3 text-base rounded-md border border-border bg-card focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <button
          type="submit"
          className="h-10 px-4 text-sm rounded-md bg-primary text-white hover:bg-primary-dark transition-colors"
        >
          搜索
        </button>
      </form>

      <div className="mt-10 grid grid-cols-2 sm:grid-cols-3 gap-3 text-left">
        {HOT_LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="rounded-lg border border-border bg-card px-4 py-3 hover:border-primary/50 hover:shadow-sm transition-all"
          >
            <p className="text-sm font-bold">{l.title}</p>
            <p className="text-xs text-muted mt-1">{l.desc}</p>
          </Link>
        ))}
      </div>

      <Link href="/" className="inline-block mt-10 text-sm text-primary hover:underline">
        ← 返回首页
      </Link>
    </div>
  );
}
