import { PageHeader } from "@/components/page-parts";
import { TasksView } from "@/components/tasks/tasks-view";

export const metadata = { title: "任务" };

export default function Page() {
  return (
    <div>
      <PageHeader
        title="任务"
        description="创建、跟踪任务，点击左侧图标流转状态，星标设为今日焦点"
      />
      <TasksView />
    </div>
  );
}
