import Link from "next/link";
import { ArrowLeft, CheckCircle2, AlertTriangle, Database, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui";

export const metadata = { title: "来源核对清单 | 研究体系 GMRDS" };

/** 来源核对清单：每条关键数据的来源 / 核验日期 / 核验结果 / 口径（2026-08-25 审计） */
const SOURCES: {
  data: string;
  source: string;
  verified: string;
  status: "已核验" | "未确证" | "待接入" | "框架设定";
  note: string;
}[] = [
  { data: "上证综指年度收盘（2021-2026）", source: "腾讯财经 fqkline（data/sh-index.json）", verified: "2026-08-21", status: "已核验", note: "收盘价口径，与数据文件一致" },
  { data: "上证关键区间点位（3715.37/2886.43/3395.00/2702.19/3489.78）", source: "腾讯财经日线（脚本核验）", verified: "2026-08-21", status: "已核验", note: "收盘价口径，已修正此前不精确数值" },
  { data: "上证 2026 最新收盘 3905.20", source: "腾讯财经 fqkline", verified: "2026-08-21", status: "已核验", note: "08-21 收盘" },
  { data: "标普500 年度收盘（2021-2025）", source: "data/us-market.json", verified: "2026-08-21", status: "已核验", note: "2025 为腾讯接口实测收盘，全年 OHLC 未确证" },
  { data: "纳指 2021-2022 年度数据", source: "data/us-market.json", verified: "2026-08-21", status: "已核验", note: "与公开行情一致" },
  { data: "纳指 2023-2024 OHLC", source: "data/us-market.json", verified: "2026-08-21", status: "未确证", note: "原为占位整数，已标 null；收盘价保留" },
  { data: "纳指 2025 数据", source: "—", verified: "2026-08-21", status: "未确证", note: "数据缺失，已标注" },
  { data: "贵州茅台估值快照（PE 17.87/PB 6.33/EPS 19.54）", source: "东方财富 /api/stock/fundamentals", verified: "2026-08-25", status: "已核验", note: "实时接口，随行情变化" },
  { data: "贵州茅台日 K（前复权）", source: "东方财富 /api/stock/kline", verified: "2026-08-25", status: "已核验", note: "真实前复权行情" },
  { data: "危机历史数据（1929-2020 六场）", source: "公开史料/权威历史记录整理", verified: "2026-08-25", status: "已核验", note: "文件头已加来源声明，存在历史口径差异" },
  { data: "牛熊周期原始数据", source: "腾讯财经（data/bull-bear-raw.json）", verified: "2026-08-21", status: "已核验", note: "起点 100 为上证基期" },
  { data: "两融余额 / 北向资金 / DR007 / 新基金发行", source: "交易所 / 银行间 / 基金业协会", verified: "—", status: "待接入", note: "接口接入后自动回填" },
  { data: "股债性价比 ERP / 估值分位", source: "中债 / FRED / 指数公司", verified: "—", status: "待接入", note: "Wind/Bloomberg 为机构级来源" },
  { data: "情绪阈值（融资占比 9%、成交 1.5 万亿等）", source: "研究设定", verified: "—", status: "框架设定", note: "待真实数据接入后回测验证" },
  { data: "评分阈值（65 分进攻等）", source: "决策委员会框架", verified: "—", status: "框架设定", note: "V2.0 量化模块回测校准后生效" },
];

const STATUS_TONE: Record<string, string> = {
  已核验: "#16a34a",
  未确证: "#f59e0b",
  待接入: "#64748b",
  框架设定: "#8b5cf6",
};

export default function GmrdsSourcesPage() {
  const counts = SOURCES.reduce<Record<string, number>>((acc, s) => {
    acc[s.status] = (acc[s.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-7xl px-3 sm:px-4 py-5 sm:py-6 space-y-6">
      {/* 头部 */}
      <section className="rounded-xl border border-border bg-gradient-to-br from-primary/8 via-transparent to-transparent p-6 sm:p-8">
        <div className="flex items-center gap-2 text-xs text-muted mb-3">
          <Link href="/gmrds" className="hover:text-primary">研究体系 GMRDS</Link>
          <span>/</span>
          <span className="text-foreground font-medium">来源核对清单</span>
        </div>
        <h1 className="font-black text-2xl sm:text-3xl tracking-tight mb-3">数据来源核对清单</h1>
        <p className="text-sm text-muted leading-relaxed max-w-3xl">
          真实性审计交付物：逐条列出关键数据的来源、核验日期与核验结果。
          「已核验」为可溯源真实数据；「未确证」为缺失或存疑（已标注原因）；「待接入」为暂无法获取、
          明确标注缺失与建议来源，不采用编造数值充数；「框架设定」为研究阈值，待数据接入后回测验证。
        </p>
        <div className="flex flex-wrap gap-2 mt-4">
          {Object.entries(counts).map(([k, v]) => (
            <span key={k} className="inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-full border border-border">
              <span className="w-2 h-2 rounded-full" style={{ background: STATUS_TONE[k] }} />
              {k} {v} 项
            </span>
          ))}
        </div>
      </section>

      {/* 核对清单表 */}
      <section>
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm min-w-[760px]">
            <thead>
              <tr className="text-xs text-muted border-b border-border">
                <th className="text-left py-2.5 pl-4 pr-3 font-medium">数据 / 内容</th>
                <th className="text-left px-3 font-medium w-56">来源</th>
                <th className="text-left px-3 font-medium w-28">核验日期</th>
                <th className="text-left px-3 font-medium w-24">结果</th>
                <th className="text-left px-3 pr-4 font-medium">说明</th>
              </tr>
            </thead>
            <tbody>
              {SOURCES.map((s) => (
                <tr key={s.data} className="border-b border-border/50 last:border-0 align-top">
                  <td className="py-2.5 pl-4 pr-3 font-medium">{s.data}</td>
                  <td className="py-2.5 px-3 text-muted text-xs leading-relaxed">{s.source}</td>
                  <td className="py-2.5 px-3 text-xs text-muted">{s.verified}</td>
                  <td className="py-2.5 px-3">
                    <span className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded font-medium" style={{ color: STATUS_TONE[s.status], background: `${STATUS_TONE[s.status]}18` }}>
                      {s.status === "已核验" ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                      {s.status}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 pr-4 text-xs text-muted leading-relaxed">{s.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </section>

      {/* 审计方法与口径 */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card className="p-4">
          <h2 className="flex items-center gap-2 font-bold text-sm mb-2"><Database className="w-4 h-4 text-primary" /> 审计方法</h2>
          <ul className="space-y-1.5 text-xs text-muted leading-relaxed">
            <li>· 行情类数据：直接读取项目数据文件（sh-index.json / us-market.json）并用脚本复核关键点位</li>
            <li>· 个股数据：调用东方财富实时接口核验（kline / fundamentals / finance-trend）</li>
            <li>· 宏观事实（降准降息等）：以央行官网等权威渠道为口径</li>
            <li>· 演示/示例数据：逐条甄别，真实可得的替换为真实值，不可得的标注「数据缺失 + 原因 + 建议来源」</li>
            <li>· 研究阈值与结论：明确标注「框架设定 / 研究判断」，未核验数值一律不展示</li>
          </ul>
        </Card>
        <Card className="p-4">
          <h2 className="flex items-center gap-2 font-bold text-sm mb-2"><AlertTriangle className="w-4 h-4 text-primary" /> 已知限制与后续</h2>
          <ul className="space-y-1.5 text-xs text-muted leading-relaxed">
            <li>· 两融/DR007/ERP 等需交易所、银行间、中债/FRED 数据源接入（Wind/Bloomberg 为机构级选项）</li>
            <li>· 纳指 2023-2025 部分字段未确证，已标注待补</li>
            <li>· 阈值与评分权重待 V2.0 量化模块回测校准</li>
            <li>· 本清单随数据接入与核验持续更新（下次核验：数据源接入后）</li>
          </ul>
        </Card>
      </section>

      {/* 2026-08-27 整改记录 */}
      <section>
        <Card className="p-4">
          <h2 className="flex items-center gap-2 font-bold text-sm mb-2"><ShieldCheck className="w-4 h-4 text-primary" /> 2026-08-27 全量数据真实性整改记录</h2>
          <div className="space-y-2 text-xs text-muted leading-relaxed">
            <p><b className="text-foreground">① 行情数据（quotes.ts）</b>：移除全部 <code className="px-1 rounded bg-muted/30">Math.random()</code> 假数据 fallback → 东财失败时降级为<b>新浪真实实时行情</b>（A股 6 指数/美股三大/恒指/KOSPI/印度/汇率）；黄金/原油/部分欧亚指数无免费实时源则过滤不展示。上证实测 3956.57（+1.13%）为真实值。</p>
            <p><b className="text-foreground">② 北向资金（market.ts）</b>：随机估算值 → 接口失败返回 <code className="px-1 rounded bg-muted/30">null</code>（前端显示"暂不可用"），不再生成假数据。</p>
            <p><b className="text-foreground">③ 宏观指标（macro/page.tsx）</b>：原仅 9 项标真实，实为东财数据中心 24 项全真实（GDP/CPI/PPI/PMI/M2/社融/利率/汇率等，200 期/项，macro-sync.ts 同步）→ REAL 集合补全，删除"演示数据"标注。</p>
            <p><b className="text-foreground">④ 环节 5 茅台财务（gmrds-deep.ts）</b>：ROE/毛利率"待接入" → 东财 F10 真实值（ROE 16.75% / 毛利率 89.56%，2026 中报）。</p>
            <p><b className="text-foreground">⑤ 环节 9 风险指标（gmrds-deep.ts）</b>："数据缺失" → 上证综指真实日线自算（年化波动 16.6% / 最大回撤 -27.3% / VaR95 -1.6%，2020-2026）。</p>
            <p><b className="text-foreground">⑥ HistoryAxis 组件</b>：修复 theme 切换时 chart dispose 后仍 off() 的崩溃（isDisposed 防御）。</p>
            <p><b className="text-foreground">保留标注项</b>：两融/DR007/ERP（无免费接口，标"待接入"）；雷达图安然/雷曼/瑞幸特征为<b>案例教学值</b>（教学用途，注明可验证）；危机史实数据附来源声明。</p>
          </div>
        </Card>
      </section>

      <div className="flex items-center gap-3 border-t border-border pt-4">
        <Link href="/gmrds" className="inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-primary">
          <ArrowLeft className="w-3.5 h-3.5" /> 返回体系总览
        </Link>
        <p className="text-[10px] text-muted ml-auto">核验日期：2026-08-25 · 口径：收盘价 / 实时接口 / 史料整理</p>
      </div>
    </div>
  );
}
