import type { Metadata } from "next";
import { PageHeader } from "@/components/page-parts";
import { TasksView } from "@/components/tasks/tasks-view";

export const metadata: Metadata = { title: "任务" };

export default function Page() {
  return (
    <>
      <PageHeader
        title="任务"
        description="点击左侧图标流转状态，点星标设为今日焦点；支持按状态、项目与关键词筛选。"
      />
      <TasksView />
    </>
  );
}
