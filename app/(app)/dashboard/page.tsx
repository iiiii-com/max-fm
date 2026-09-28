import { requireUser } from "@/lib/session";

export default async function DashboardPage() {
  const user = await requireUser();
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">
        你好，{user.name} 👋
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        登录成功。仪表盘正在建设中——任务、考勤、工时模块即将就绪。
      </p>
    </div>
  );
}
