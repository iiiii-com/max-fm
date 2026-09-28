import { PageHeader } from "@/components/page-parts";
import { ReportView } from "@/components/reports/report-view";

export const metadata = { title: "报表" };

export default function Page() {
  return (
    <div>
      <PageHeader
        title="报表"
        description="把任务、工时、考勤数据聚合成直观图形；点击图表可下钻查看明细"
      />
      <ReportView />
    </div>
  );
}
