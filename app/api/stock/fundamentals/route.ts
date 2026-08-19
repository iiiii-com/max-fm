import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secid = new URL(req.url).searchParams.get("secid") || "";
  if (!/^[01]\.\d{6}$/.test(secid)) {
    return NextResponse.json({ error: "invalid secid" }, { status: 400 });
  }
  const fields = "f57,f58,f43,f116,f117,f162,f167,f92,f168,f164,f60";
  const url = `https://push2.eastmoney.com/api/qt/stock/get?secid=${secid}&fields=${fields}&fltt=2&invt=2`;
  const res = await fetch(url, { next: { revalidate: 300 } });
  if (!res.ok) return NextResponse.json({ error: `eastmoney ${res.status}` }, { status: 502 });
  const json = await res.json();
  const d = json?.data;
  if (!d) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({
    ok: true,
    data: {
      name: d.f58, code: d.f57, price: d.f43,
      totalMv: d.f116, floatMv: d.f117,
      pe: d.f162, pb: d.f167, bps: d.f92, eps: d.f164, turnover: d.f168, prevClose: d.f60,
    },
  });
}