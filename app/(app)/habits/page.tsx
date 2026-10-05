import type { Metadata } from "next";
import { ComingSoon, PageHeader } from "@/components/page-parts";

export const metadata: Metadata = { title: "习惯" };

export default function Page() {
  return (
    <>
      <PageHeader
        title="习惯"
        description="追踪每日打卡型习惯，连续天数会同步到工作节奏热力图。"
      />
      <ComingSoon title="习惯" />
    </>
  );
}
