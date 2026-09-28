import { ComingSoon, PageHeader } from "@/components/page-parts";

export const metadata = { title: "周报" };

export default function Page() {
  return (
    <div>
      <PageHeader title="周报" />
      <ComingSoon title="周报" />
    </div>
  );
}
