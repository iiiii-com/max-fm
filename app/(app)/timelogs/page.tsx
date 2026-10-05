import type { Metadata } from "next";
import { PageHeader } from "@/components/page-parts";
import { TimelogsView } from "@/components/timelogs/timelogs-view";

export const metadata: Metadata = { title: "工时" };

export default function Page() {
  return (
    <>
      <PageHeader
        title="工时"
        description="按周视图填报工时并关联任务；番茄钟专注结束后会自动记录。"
      />
      <TimelogsView />
    </>
  );
}
