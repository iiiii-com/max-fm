/**
 * 危机阶段策略覆盖率回归 —— 防止「专业解读」退化为通用模板。
 *
 * 背景：
 * 阶段策略原本是 CrisisEngine.tsx 内的 STAGE_TIPS 常量，只覆盖 2 场共 11 个阶段；
 * 其余 18 场 / 57 个阶段（83.8%）走 fallbackTip()，返回同一段
 * "熊市铁律 / 牛市铁律 / 震荡铁律" + grade:"C" + winRate:"通用纪律"。
 * 20 场危机里 19 场在看同一段模板，且界面上没有任何提示这是占位内容。
 *
 * 现在策略下沉到 lib/data/crisis/strategies.ts，本脚本断言：
 *   1. 每场危机的策略数组长度与 stages 长度严格一致（下标一一对应，错位会串场）
 *   2. 不存在缺失 / 空字符串 / 通用模板残留（"铁律"、"通用纪律"）
 *   3. grade / winRate / drawdown 四件套齐全
 *   4. 没有 crisis 未配置策略
 *
 * 运行：npx tsx scripts/verify-crisis-tips.ts
 */
import { CRISES } from "@/lib/data/crisis/crises";
import { STAGE_STRATEGIES } from "@/lib/data/crisis/strategies";

/** 曾经的通用模板特征词，出现即视为退化 */
const TEMPLATE_MARKERS = ["铁律", "通用纪律", "牛市铁律", "熊市铁律", "震荡铁律"];

let failed = 0;
const fail = (msg: string) => {
  console.log(`  FAIL  ${msg}`);
  failed++;
};
const pass = () => process.stdout.write(".");

let checkedStages = 0;
const uncovered: string[] = [];

for (const crisis of CRISES) {
  const tips = STAGE_STRATEGIES[crisis.id];
  const stages = crisis.stages ?? [];

  if (!Array.isArray(tips)) {
    fail(`${crisis.id}（${crisis.title}）未配置阶段策略`);
    continue;
  }
  if (tips.length !== stages.length) {
    fail(
      `${crisis.id}（${crisis.title}）策略数 ${tips.length} ≠ 阶段数 ${stages.length}：` +
        `下标无法一一对应，会出现"第 3 段看到第 2 段策略"的串场`
    );
    continue;
  }

  stages.forEach((stage, i) => {
    checkedStages++;
    const tip = tips[i];
    const at = `${crisis.id} 阶段[${i}] ${stage.name}`;

    if (!tip) {
      fail(`${at}：策略缺失`);
      uncovered.push(at);
      return;
    }
    for (const key of ["strategy", "winRate", "drawdown"] as const) {
      const v = (tip as unknown as Record<string, unknown>)[key];
      if (typeof v !== "string" || !v.trim()) fail(`${at}：${key} 为空`);
    }
    if (!["A", "B", "C"].includes(tip.grade)) fail(`${at}：grade 非法 ${String(tip.grade)}`);

    for (const marker of TEMPLATE_MARKERS) {
      if (tip.strategy?.includes(marker)) {
        fail(`${at}：strategy 含通用模板词「${marker}」——这是占位内容，不是场景化策略`);
      }
    }
    // 单条策略至少要说清"做什么"，短于 24 字基本等于没写
    if ((tip.strategy?.length ?? 0) < 24) fail(`${at}：strategy 过短（${tip.strategy?.length} 字）`);
  });
  pass();
}

const orphans = Object.keys(STAGE_STRATEGIES).filter(
  (id) => !CRISES.some((c) => c.id === id)
);
if (orphans.length) fail(`策略表存在孤儿 crisis id：${orphans.join(", ")}`);

console.log(`\n\n=== 危机阶段策略覆盖：${CRISES.length} 场 / ${checkedStages} 阶段 ===`);
if (uncovered.length) {
  console.log(`未覆盖阶段（${uncovered.length}）：`);
  uncovered.forEach((u) => console.log(`  - ${u}`));
}
console.log(`=== 结果：${failed === 0 ? "全部通过" : `${failed} 项失败`} ===`);
if (failed) process.exit(1);
