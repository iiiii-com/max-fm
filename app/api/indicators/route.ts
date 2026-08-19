import { NextResponse } from "next/server";
import { getIndicators } from "@/lib/data/queries";
import { bootstrap } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  await bootstrap();
  const rows = await getIndicators();
  return NextResponse.json(
    rows.map((r: any) => ({ type: r.type, date: r.date, value: r.value })),
    { headers: { "Cache-Control": "no-store" } },
  );
}