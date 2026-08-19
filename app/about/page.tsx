import { Card } from "@/components/ui";

export const metadata = { title: "关于我们" };

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 space-y-6">
      <header>
        <h1 className="text-2xl font-bold">关于 Max 财经</h1>
      </header>
      <Card>
        <p className="text-sm text-muted leading-relaxed">
          Max 财经数据平台是一个 AI 驱动的财经数据分析网站，愿景是<span className="font-semibold text-foreground">“用数据理解经济，用理性面对温差”</span>。
        </p>
      </Card>
      <Card>
        <h2 className="font-bold mb-3">六大模块</h2>
        <ul className="text-sm text-muted space-y-2 leading-relaxed list-disc pl-5">
          <li><span className="font-semibold text-foreground">宏观经济</span>：GDP/CPI/PMI 等指标仪表盘 + AI 月度报告</li>
          <li><span className="font-semibold text-foreground">政策解读</span>：政策库 + 三层 AI 解读（普通人 / 投资者 / 专业）</li>
          <li><span className="font-semibold text-foreground">投资分析</span>：实时行情、板块热度、每日 AI 复盘</li>
          <li><span className="font-semibold text-foreground">经济分布图</span>：31 省数据地图可视化</li>
          <li><span className="font-semibold text-foreground">产业链分析</span>：6 条主线上下游关系图谱</li>
          <li><span className="font-semibold text-foreground">个人建议</span>：问卷 → AI 个性化资产配置建议</li>
        </ul>
      </Card>
      <Card>
        <h2 className="font-bold mb-3">特色功能</h2>
        <p className="text-sm text-muted leading-relaxed">
          <span className="font-semibold text-foreground">宏观温度 vs 个人体感</span>：用温度计形式直观对比“数据的经济”与“体感的经济”，解释温差来源。
        </p>
      </Card>
      <Card>
        <h2 className="font-bold mb-3">技术架构</h2>
        <p className="text-sm text-muted leading-relaxed">
          Next.js 全栈 · 多模型 AI（DeepSeek / GLM / Qwen 等）· 双驱动数据库（SQLite 本地演示 / PostgreSQL 生产）· ECharts 可视化 · Vercel 部署，定时任务每日自动生成复盘与报告。
        </p>
      </Card>
      <Card>
        <h2 className="font-bold mb-3">联系我们</h2>
        <p className="text-sm text-muted leading-relaxed">意见与反馈：contact@max-fm.example</p>
      </Card>
    </div>
  );
}