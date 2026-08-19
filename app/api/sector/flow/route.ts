import { NextResponse } from "next/server";
import { fetchSectorFlow, fetchNorthbound } from "@/lib/data/market";

export const dynamic = "force-dynamic";

export async function GET() {
  const [sectors, northbound] = await Promise.all([fetchSectorFlow(30), fetchNorthbound()]);
  return NextResponse.json({ ok: true, sectors, northbound });
}