/**
 * 产业链 → 东财板块 code 回填（一次性，可重复运行）。
 *
 * 实现已移到 lib/data/chain-sector-sync.ts：
 * 本机对 push2 的连接会被间歇性掐断，而生产环境能正常访问，
 * 因此回填必须能随构建自动跑到（postbuild 调用 scripts/chain-sector-sync.ts）。
 * 本脚本只是命令行入口，便于本地 dry-run 与复核。
 *
 * 用法：npx tsx scripts/fix-chain-sector-codes.ts [--dry]
 */
import { fetchAllBoards, matchChainsToBoards, backfillChainSectorCodes } from "@/lib/data/chain-sector-sync";
import { db, bootstrap } from "@/lib/db";
import * as s from "@/lib/db/schema";

const DRY = process.argv.includes("--dry");

async function main() {
  if (!DRY) {
    const r = await backfillChainSectorCodes();
    console.log(`\n链 ${r.total} 条 / 写入 ${r.written} / 多候选 ${r.ambiguous} / 待人工 ${r.review} / 无匹配 ${r.unmatched}`);
    return;
  }

  await bootstrap();
  const chains = (await db
    .select({ slug: s.industryChains.slug, name: s.industryChains.name })
    .from(s.industryChains)) as Array<{ slug: string; name: string }>;

  console.log(`产业链 ${chains.length} 条`);
  const boards = await fetchAllBoards().catch((e) => {
    console.warn(`无法获取板块列表：${e?.message ?? e}`);
    return [];
  });
  if (!boards.length) {
    console.log("板块列表为空 —— 本次不做任何写入（BK code 不可猜测，留空是正确处理）");
    return;
  }
  const n2 = boards.filter((b) => b.kind === 2).length;
  console.log(`东财板块 ${boards.length} 个（行业 ${n2} + 概念 ${boards.length - n2}）\n`);

  const r = matchChainsToBoards(chains, boards);
  console.log(`唯一匹配 ${r.matched.length} 条:`);
  for (const m of r.matched) console.log(`  ${m.slug.padEnd(20)} ${m.code}  ${m.board}`);
  if (r.picked.length) {
    console.log(`\n多候选取最短名 ${r.picked.length} 条（留痕）:`);
    r.picked.forEach((x) => console.log(`  ${x}`));
  }
  if (r.ambiguous.length) {
    console.log(`\n同长度多候选 ${r.ambiguous.length} 条（不写入）:`);
    r.ambiguous.forEach((x) => console.log(`  ${x}`));
  }
  if (r.review.length) {
    console.log(`\n反向候选、需人工确认 ${r.review.length} 条（不写入）:`);
    r.review.forEach((x) => console.log(`  ${x}`));
  }
  console.log(`\n无匹配 ${r.unmatched.length} 条（保持为空）:`);
  r.unmatched.forEach((x) => console.log(`  ${x}`));
  console.log("\n(dry-run，未落库)");
}

main();