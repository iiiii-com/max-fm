import { Card, SectionTitle } from "@/components/ui";

export const metadata = { title: "免责声明" };

export default function DisclaimerPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 space-y-6">
      <header>
        <h1 className="text-2xl font-bold">免责声明</h1>
      </header>
      <Card>
        <SectionTitle title="1. 内容性质" />
        <p className="text-sm text-muted leading-relaxed">
          Max 财经数据平台（下称“本站”）的全部内容（包括但不限于：宏观分析、政策解读、复盘报告、投资分析、个人建议、经济分布图、产业链分析等）均由人工智能自动生成，或基于公开数据自动整理，仅供信息展示与学习交流使用。
        </p>
      </Card>
      <Card>
        <SectionTitle title="2. 不构成投资建议" />
        <p className="text-sm text-muted leading-relaxed">
          本站任何内容均不构成任何形式的投资建议、财务建议、法律建议或购买/出售任何金融产品的要约。投资者应基于自身判断并咨询持牌专业人士后作出决策。
        </p>
      </Card>
      <Card>
        <SectionTitle title="3. 数据准确性" />
        <p className="text-sm text-muted leading-relaxed">
          本站数据来源于国家统计局、中国人民银行、海关总署、财政部、各地统计局及公开行情接口等第三方渠道，可能存在延迟、误差或遗漏。AI 生成内容可能存在事实性错误。请以官方发布为准。
        </p>
      </Card>
      <Card>
        <SectionTitle title="4. 风险提示" />
        <p className="text-sm text-muted leading-relaxed">
          市场有风险，投资需谨慎。任何依据本站内容作出的投资决策，风险由使用者自行承担，本站不承担任何直接或间接损失责任。
        </p>
      </Card>
    </div>
  );
}