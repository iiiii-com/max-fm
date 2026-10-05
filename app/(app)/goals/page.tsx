import type { Metadata } from "next";
import { ComingSoon, PageHeader } from "@/components/page-parts";

export const metadata: Metadata = { title: "目标" };

export default function Page() {
  return (
    <>
      <PageHeader
        title="目标"
        description="按季度拆解目标并绑定任务，报表会汇总达成进度。"
      />
      <ComingSoon title="目标" />
    </>
  );
}
