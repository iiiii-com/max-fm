import { NextResponse } from "next/server";
import { getRiskIndicators } from "@/lib/data/risk";

export const dynamic = "force-dynamic";

export async function GET() {
  const indicators = await getRiskIndicators();
  return NextResponse.json({ ok: true, indicators });
}