import { db, uid, now } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const BASE = "https://datacenter-web.eastmoney.com/api/data/v1/get";

const DEFS: Array<{ type: string; name: string; report: string; field: string; quarter?: boolean }> = [
  { type: "gdp", name: "GDP 同比增速", report: "RPT_ECONOMY_GDP", field: "SUM_SAME", quarter: true },
  { type: "cpi", name: "CPI 同比", report: "RPT_ECONOMY_CPI", field: "NATIONAL_SAME" },
  { type: "ppi", name: "PPI 同比", report: "RPT_ECONOMY_PPI", field: "BASE_SAME" },
  { type: "pmi", name: "制造业 PMI", report: "RPT_ECONOMY_PMI", field: "MAKE_INDEX" },
  { type: "m2", name: "M2 同比增速", report: "RPT_ECONOMY_CURRENCY_SUPPLY", field: "BASIC_CURRENCY_SAME" },
  { type: "m1", name: "M1 同比增速", report: "RPT_ECONOMY_CURRENCY_SUPPLY", field: "CURRENCY_SAME" },
];

async function fetchPage(report: string, page: number, size: number): Promise<any[]> {
  const url = `${BASE}?reportName=${report}&columns=ALL&pageNumber=${page}&pageSize=${size}&sortColumns=REPORT_DATE&sortTypes=-1`;
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`eastmoney ${report} status ${res.status}`);
  const json = await res.json();
  if (!json?.success) throw new Error(`eastmoney ${report} failed`);
  return json.result?.data || [];
}

async function fetchAll(report: string, max = 300): Promise<any[]> {
  const rows: any[] = [];
  for (let page = 1; ; page++) {
    const batch = await fetchPage(report, page, 100);
    rows.push(...batch);
    if (batch.length < 100 || rows.length >= max) break;
    if (page > 10) break;
  }
  return rows.slice(0, max);
}

function toDate(iso: string, quarter: boolean): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  if (quarter) return `${d.getFullYear()}-Q${Math.ceil((d.getMonth() + 1) / 3)}`;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export async function syncMacroReal(): Promise<{ type: string; count: number }[]> {
  const results: { type: string; count: number }[] = [];
  for (const def of DEFS) {
    const raw = await fetchAll(def.report);
    const rows = raw
      .map((r: any) => {
        const date = toDate(r.REPORT_DATE, !!def.quarter);
        const value = Number(r[def.field]);
        if (!date || !Number.isFinite(value)) return null;
        return { date, value: Math.round(value * 10) / 10 };
      })
      .filter((x: any): x is { date: string; value: number } => !!x)
      .sort((a: any, b: any) => a.date.localeCompare(b.date));
    if (!rows.length) throw new Error(`empty rows for ${def.type}`);
    await db.delete(s.economicIndicators).where(eq(s.economicIndicators.type, def.type));
    const ts = now();
    const inserts = rows.map((r) => ({
      id: uid("ind"), name: def.name, type: def.type, date: r.date, value: r.value,
      category: def.type === "gdp" ? "总量" : def.type === "pmi" ? "景气" : def.type === "cpi" || def.type === "ppi" ? "物价" : "货币",
      unit: "%", source: "东方财富数据中心", createdAt: ts, updatedAt: ts,
    }));
    for (let i = 0; i < inserts.length; i += 100) {
      await db.insert(s.economicIndicators).values(inserts.slice(i, i + 100) as any).onConflictDoNothing();
    }
    results.push({ type: def.type, count: inserts.length });
  }
  return results;
}
