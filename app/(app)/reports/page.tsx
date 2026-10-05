import type { Metadata } from "next";
import { PageHeader } from "@/components/page-parts";
import { ReportView } from "@/components/reports/report-view";

export const metadata: Metadata = { title: "报表" };

export default function Page() {
  return (
    <>
      <PageHeader
        title="报表"
        description="把任务、工时、考勤聚合成直观图形；点击趋势点或排行条目可下钻查看明细。"
      />
      <ReportView />
    </>
  );
}
