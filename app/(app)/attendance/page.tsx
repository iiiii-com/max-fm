import type { Metadata } from "next";
import { PageHeader } from "@/components/page-parts";
import { AttendanceView } from "@/components/attendance/attendance-view";

export const metadata: Metadata = { title: "考勤" };

export default function Page() {
  return (
    <>
      <PageHeader
        title="考勤"
        description="一键上/下班打卡，09:30 后上班自动记为迟到；支持请假登记与出勤日历回看。"
      />
      <AttendanceView />
    </>
  );
}
