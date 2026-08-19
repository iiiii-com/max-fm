import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-border mt-12">
      <div className="mx-auto max-w-7xl px-4 py-8 text-sm text-muted">
        <div className="flex flex-col md:flex-row gap-6 md:items-center justify-between">
          <div>
            <p className="font-bold text-foreground mb-1">Max 财经数据平台</p>
            <p>AI 自动生成的内容仅供参考，不构成任何投资建议。数据来源于公开渠道，可能存在延迟或误差。</p>
          </div>
          <nav className="flex gap-4">
            <Link href="/disclaimer" className="hover:text-foreground">免责声明</Link>
            <Link href="/privacy" className="hover:text-foreground">隐私政策</Link>
            <Link href="/about" className="hover:text-foreground">关于我们</Link>
          </nav>
        </div>
        <p className="mt-4 text-xs opacity-70">© {new Date().getFullYear()} Max 财经 · 用数据理解经济，用理性面对温差</p>
      </div>
    </footer>
  );
}