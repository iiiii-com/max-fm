# Max 财经数据平台

AI 驱动的全方位财经数据分析网站：**用数据理解经济，用理性面对温差**。

## 功能模块

| 模块 | 说明 |
|---|---|
| 宏观经济 | GDP / CPI / PPI / PMI / M2 / 社融等指标仪表盘 + AI 月度报告 |
| 政策解读 | 政策库 + 三层 AI 解读（普通人视角 / 投资者视角 / 专业视角） |
| 投资分析 | 实时指数行情（东方财富接口）、板块热度、每日 AI 复盘 |
| 经济分布图 | 31 省 GDP / 增速 / 人均 GDP / 进出口 地图可视化 |
| 产业链分析 | 6 条主线（新能源车 / 半导体 / AI / 医药 / 地产 / 白酒）力导向图谱 |
| 个人建议 | 问卷 → AI 生成个性化资产配置建议（需登录） |
| 宏观温度 vs 个人体感 | 温度计对比 + 温差报告 + 体感问卷聚合 |

## 快速开始

```bash
npm install
npm run seed      # 初始化演示数据（指标 2015 至今 / 31 省 / 政策 / 文章 / 体感问卷）
npm run dev       # http://localhost:3000
```

- 零配置：未设置 `DATABASE_URL` 时自动使用本地 SQLite（`data/max.db`）。
- 配置 AI：复制 `.env.example` 为 `.env.local`，填写任意 OpenAI 兼容服务的 Key；未配置时 AI 内容使用内置模板降级，站点功能完整可用。

## 技术栈

- Next.js 16（App Router）+ React 19 + Tailwind CSS 4
- Drizzle ORM（双驱动：SQLite 本地 / PostgreSQL 生产）
- ECharts（折线图 / 地图 / 仪表盘 / 力导向图）
- AI SDK 多模型混合（DeepSeek / GLM / Qwen 等，OpenAI 兼容协议）
- JWT 会话认证（jose + bcryptjs）

## 部署（Vercel）

1. 推送代码到 GitHub，在 Vercel 导入仓库。
2. 环境变量：`DATABASE_URL`（Neon Postgres）、`AUTH_SECRET`、AI Keys（可选）。
3. Cron 已配置在 `vercel.json`：工作日收盘后生成复盘、月初生成宏观月报与温差报告。
4. `CRON_SECRET` 与 `vercel.json` 中的 `__CRON_SECRET__` 替换值保持一致。

## 目录结构

```
app/          页面与 API 路由
components/   布局 / 图表 / 表单组件
lib/db/       Drizzle schema + 双驱动数据库引导
lib/data/     查询函数 / 行情抓取
lib/ai/       多模型 AI 客户端
lib/auth.ts   JWT 会话
scripts/      种子数据脚本
data/         SQLite 数据库 + 中国地图 GeoJSON
```

## 免责声明

本站内容（含 AI 生成报告）仅供信息展示与学习交流，不构成任何投资建议。数据可能存在延迟或误差，请以官方发布为准。市场有风险，投资需谨慎。