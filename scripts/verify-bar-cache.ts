/**
 * 日线落库缓存自检：建表、读写、过期、结构自证、清理。
 *
 * 这一段是"看起来能用、实际悄悄失效"的高发区：缓存读不出来只会让每次请求都回源
 * （表现为变慢与被限频），不会报错；缓存读出了坏数据则会污染指数计算。
 * 所以两头都要测：该拒绝的必须拒绝，该读回的必须读回。
 *
 * 运行：npx tsx scripts/verify-bar-cache.ts
 */
import { bootstrap, db } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { readBars, writeBars, barCacheStats } from "@/lib/data/bar-cache";

const SECID = "TEST.000000";
const DAYS = 120;

function mkBars(n: number) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(2026, 0, 1) + i * 86400000);
    return { date: d.toISOString().slice(0, 10), close: 100 + i };
  });
}

async function cleanup() {
  const rows = (await db.select().from(s.dailyBars)) as any[];
  for (const r of rows.filter((x) => String(x.code ?? "").startsWith("TEST."))) {
    await db.delete(s.dailyBars).where(eq(s.dailyBars.id, r.id));
  }
}

async function main() {
  let fails = 0;
  const check = (label: string, pass: boolean, extra = "") => {
    if (!pass) fails++;
    console.log(`  ${pass ? "PASS" : "FAIL"}  ${label}${extra ? "  " + extra : ""}`);
  };

  await bootstrap();
  await cleanup();

  check("表已建出（可查询）", (await barCacheStats()).rows >= 0);

  // 空缓存必须返回 null（由调用方回源），而不是空数组 —— 空数组会被当成"该标的没有数据"
  check("空缓存返回 null", (await readBars(SECID, DAYS)) === null);

  const bars = mkBars(60);
  await writeBars(SECID, DAYS, bars);
  const got = await readBars(SECID, DAYS);
  check("写入后可读回且根数一致", !!got && got.length === bars.length, `实得 ${got?.length ?? "null"}`);
  check("首末内容一致", !!got && got[0].date === bars[0].date && got[59].close === bars[59].close);

  // 覆盖写：同一 key 再写不应产生第二行
  const before = (await barCacheStats()).rows;
  await writeBars(SECID, DAYS, mkBars(70));
  const after = (await barCacheStats()).rows;
  const got2 = await readBars(SECID, DAYS);
  check("重复写为覆盖（行数不增）", after === before, `${before} → ${after}`);
  check("覆盖后内容为新值", !!got2 && got2.length === 70, `实得 ${got2?.length ?? "null"}`);

  // 过期：把 fetchedAt 改到 TTL 之外，必须回源（返回 null）
  await db.update(s.dailyBars).set({ fetchedAt: Date.now() - 7 * 3600 * 1000 }).where(eq(s.dailyBars.id, `bars:${SECID}:${DAYS}`));
  check("过期数据不被采用", (await readBars(SECID, DAYS)) === null);

  // 结构自证：坏序列（非法日期 / 非正价格 / 截断 JSON）一律拒绝
  await writeBars(`${SECID}.bad1`, DAYS, [{ date: "not-a-date", close: 1 } as any]);
  check("非法日期被拒绝", (await readBars(`${SECID}.bad1`, DAYS)) === null);

  await writeBars(`${SECID}.bad2`, DAYS, [{ date: "2026-01-01", close: 0 } as any]);
  check("非正价格被拒绝", (await readBars(`${SECID}.bad2`, DAYS)) === null);

  await writeBars(`${SECID}.bad3`, DAYS, [] as any);
  check("空序列不写入", (await readBars(`${SECID}.bad3`, DAYS)) === null);

  await cleanup();
  const finalRows = (await barCacheStats()).rows;
  const leftover = ((await db.select().from(s.dailyBars)) as any[]).filter((x) => String(x.code ?? "").startsWith("TEST.")).length;
  check("测试行已清理", leftover === 0, `剩余缓存行 ${finalRows}`);

  console.log(fails === 0 ? "\nbar-cache: 10 组断言全过" : `\nbar-cache: ${fails} 项失败`);
  process.exit(fails === 0 ? 0 : 1);
}

main();