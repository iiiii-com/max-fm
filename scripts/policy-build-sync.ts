/**
 * 构建时政策同步（postbuild）
 *
 * 背景：生产环境（Vercel serverless）文件系统只读，定时任务无法把政策写入
 * data/max.db（SQLite），导致政策解读停留在构建时快照、总是滞后。
 * 方案：在每次构建（部署）前重新抓取政策并写入 data/max.db，随部署产物带上
 * 最新数据 → 每次发布即刷新政策库。治本方案是配置 DATABASE_URL（PostgreSQL），
 * 本脚本在 PG 模式下跳过（写入由定时任务完成）。
 *
 * 用法：package.json 中 "postbuild": "tsx scripts/policy-build-sync.ts"
 */
import { isPg } from "../lib/db";

async function main() {
  console.log("[policy-build-sync] start", new Date().toISOString());
  if (isPg) {
    console.log("[policy-build-sync] DATABASE_URL 已配置（PG 模式），跳过构建时同步（由定时任务持久化写入）");
    return;
  }
  try {
    const { syncPoliciesReal } = await import("../lib/data/policy-sync");
    const results = await syncPoliciesReal();
    for (const r of results) {
      console.log(`[policy-build-sync] ${r.org}: 新增 ${r.inserted}${r.error ? ` (error: ${r.error})` : ""}`);
    }
    const total = results.reduce((a, x) => a + (x.inserted || 0), 0);
    console.log(`[policy-build-sync] done, total inserted=${total}`, new Date().toISOString());
  } catch (e) {
    console.error("[policy-build-sync] failed:", e instanceof Error ? e.message : e);
    // 不阻塞构建：同步失败时沿用旧数据，构建继续
    process.exit(0);
  }
}

main();
