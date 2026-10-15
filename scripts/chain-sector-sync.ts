/**
 * 构建时回填产业链 → 板块 code（postbuild）。
 *
 * 为什么必须在构建时跑：本机对 push2 的连接会被间歇性掐断，而生产环境能正常访问。
 * 不放进构建流程，这个映射就永远补不上，「产业链 → 板块资金流」会一直是断的。
 *
 * 幂等：已是最新的条目不会重复写；上游不可达时不做任何写入并退出（不阻塞构建）。
 *
 * 用法：package.json 的 postbuild 里调用（PG 与 SQLite 两种模式都适用）。
 */
import { backfillChainSectorCodes } from "@/lib/data/chain-sector-sync";

async function main() {
  console.log("[chain-sector-sync] start", new Date().toISOString());
  try {
    const r = await backfillChainSectorCodes();
    console.log(`[chain-sector-sync] done 链 ${r.total} 条 / 写入 ${r.written}`, new Date().toISOString());
  } catch (e) {
    console.error("[chain-sector-sync] failed（不阻塞构建）:", e instanceof Error ? e.message : e);
  }
}

main();