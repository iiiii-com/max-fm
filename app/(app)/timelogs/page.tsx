import { PageHeader } from "@/components/page-parts";
import { TimelogsView } from "@/components/timelogs/timelogs-view";

export const metadata = { title: "工时" };

export default function Page() {
  return (
    <div>
      <PageHeader
        title="工时"
        description="按日填报工时可关联任务；番茄钟专注结束后会自动记录"
      />
      <TimelogsView />
    </div>
  );
}
