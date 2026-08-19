import { Card, SectionTitle } from "@/components/ui";

export const metadata = { title: "隐私政策" };

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 space-y-6">
      <header>
        <h1 className="text-2xl font-bold">隐私政策</h1>
      </header>
      <Card>
        <SectionTitle title="1. 我们收集的信息" />
        <p className="text-sm text-muted leading-relaxed">
          注册与登录：邮箱、昵称、密码（加密存储）。体感问卷：收入/就业/物价等主观感受选项及年龄段、职业、地区（匿名统计用）。个人建议：问卷答案与生成的建议报告。
        </p>
      </Card>
      <Card>
        <SectionTitle title="2. 信息的使用" />
        <p className="text-sm text-muted leading-relaxed">
          用于：生成与保存你的个人建议、匿名聚合“大众体感温度”、优化内容与服务。我们不会向任何第三方出售你的个人信息。
        </p>
      </Card>
      <Card>
        <SectionTitle title="3. 数据存储" />
        <p className="text-sm text-muted leading-relaxed">
          密码使用 bcrypt 单向哈希存储，会话使用 JWT（有效期 30 天）。数据库部署于云服务商，采取行业标准安全措施。
        </p>
      </Card>
      <Card>
        <SectionTitle title="4. 你的权利" />
        <p className="text-sm text-muted leading-relaxed">
          你可以随时申请注销账号并删除全部个人数据（联系我们：privacy@max-fm.example）。体感问卷可匿名提交，不影响使用其他功能。
        </p>
      </Card>
    </div>
  );
}