import type { Metadata } from "next";
import { ComingSoon, PageHeader } from "@/components/page-parts";

export const metadata: Metadata = { title: "周报" };

export default function Page() {
  return (
    <>
      <PageHeader
        title="周报"
        description="自动汇总本周工时、任务完成与出勤情况，一键生成可复制的周报文本。"
      />
      <ComingSoon title="周报" />
    </>
  );
}
