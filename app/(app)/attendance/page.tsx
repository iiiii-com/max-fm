import { PageHeader } from "@/components/page-parts";
import { AttendanceView } from "@/components/attendance/attendance-view";

export const metadata = { title: "考勤" };

export default function Page() {
  return (
    <div>
      <PageHeader
        title="考勤"
        description="一键上/下班打卡，09:30 后上班自动记为迟到；支持请假登记"
      />
      <AttendanceView />
    </div>
  );
}
