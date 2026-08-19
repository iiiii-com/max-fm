import { NextResponse } from "next/server";
import { fetchQuotes, fetchSectors } from "@/lib/data/quotes";

export const dynamic = "force-dynamic";

export async function GET() {
  const [quotes, sectors] = await Promise.all([fetchQuotes(), fetchSectors()]);
  return NextResponse.json({ quotes, sectors, time: Date.now() });
}