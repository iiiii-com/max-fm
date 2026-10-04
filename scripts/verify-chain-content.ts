import { db, bootstrap } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { ALL_CHAIN_INSIGHTS } from "@/lib/data/chainInsightsAll";
import {
  ALL_CHAIN_ECONOMICS,
  ALL_CHAIN_CAREERS,
} from "@/lib/data/chainDeepDiveAll";
import {
  ALL_CHAIN_NODE_DETAILS,
  ALL_CHAIN_NODE_INSIGHTS,
} from "@/lib/data/chainNodeDetailsAll";
import {
  ALL_GLOBAL_POSITION,
  ALL_CYCLE,
} from "@/lib/data/chainCyclePosition";
import { ALL_CHAIN_CITIES, ALL_PROS_CONS } from "@/lib/data/chainCityProsAll";
import { STATIC_REGIONS } from "@/lib/data/regions";

/**
 * 产业链解读覆盖度与字段完整性校验。
 * 目的：新增产业链或漏写字段时立刻发现，而不是等读者点进页面才发现空白。
 */
async function main() {
  await bootstrap();
  const chains = (await db.select().from(s.industryChains)) as any[];
  const slugs = chains.map((c) => c.slug);

  const problems: string[] = [];

  for (const slug of slugs) {
    if (!ALL_CHAIN_INSIGHTS[slug]?.economics) problems.push(`${slug}: 缺链级解读`);
    if (!ALL_CHAIN_ECONOMICS[slug]?.profitMap) problems.push(`${slug}: 缺利润地图`);
    if (!ALL_CHAIN_ECONOMICS[slug]?.trend) problems.push(`${slug}: 缺趋势`);
    if (!ALL_CHAIN_ECONOMICS[slug]?.drivers?.length) problems.push(`${slug}: 缺驱动力`);
    if (!ALL_CHAIN_ECONOMICS[slug]?.constraints?.length) problems.push(`${slug}: 缺制约`);
    const c = ALL_CHAIN_CAREERS[slug];
    if (!c?.hiring) problems.push(`${slug}: 缺用人结构`);
    if (!c?.payDrivers?.length) problems.push(`${slug}: 缺薪资变量`);
    if (!c?.roles?.length) problems.push(`${slug}: 缺岗位`);
    for (const r of c?.roles ?? []) {
      if (!r.title || !r.work || !r.threshold || !r.pay) {
        problems.push(`${slug}: 岗位「${r.title ?? "?"}」字段不全`);
      }
    }
  }

  // 岗位数量下限：太少说明只写了泛泛一两个岗位
  const thin = slugs.filter((x) => (ALL_CHAIN_CAREERS[x]?.roles?.length ?? 0) < 3);
  if (thin.length) problems.push(`岗位少于 3 个: ${thin.join(" ")}`);

  /**
   * 节点解读必须与库里实际的环节名逐字对应。
   * 这里踩过一次：解读表里写 "IP与内容"、seed 里是 "IP 与 content"（差一个空格），
   * 查表 miss 后静默退回模板，页面照常渲染但内容是套话 ——
   * 只查"链级覆盖"抓不到这种错误，必须按真实环节名核对。
   */
  const nodes = (await db.select().from(s.chainNodes)) as any[];
  const chainById = new Map(chains.map((c: any) => [c.id, c.slug]));
  const inlineOk = new Set(["rare-earth", "cpo"]);
  const nodesByChain = new Map<string, string[]>();
  for (const n of nodes) {
    if (n.level === "关联") continue;
    const slug = chainById.get(n.chainId);
    if (!slug) continue;
    if (!nodesByChain.has(slug)) nodesByChain.set(slug, []);
    nodesByChain.get(slug)!.push(n.name);
  }
  for (const [slug, names] of nodesByChain) {
    if (inlineOk.has(slug)) continue;
    const missing = names.filter((nm) => !ALL_CHAIN_NODE_INSIGHTS[slug]?.[nm]);
    if (missing.length) problems.push(`${slug}: 环节解读缺失或键名不匹配 → ${missing.join(" ")}`);
    const orphan = Object.keys(ALL_CHAIN_NODE_INSIGHTS[slug] ?? {}).filter(
      (k) => !names.includes(k)
    );
    if (orphan.length) problems.push(`${slug}: 解读表存在库里没有的环节名 → ${orphan.join(" ")}`);
  }

  /**
   * 环节结构化维度（做什么 / 赚什么钱 / 壁垒 / 指标 / 风险）。
   * 与上一项同样按库里真实环节名双向核对 —— 键名差一个空格就会静默失效。
   * 稀土与 CPO 的环节描述内联在 seed 里，维度表仍需覆盖，此处不豁免。
   */
  for (const [slug, names] of nodesByChain) {
    const d = ALL_CHAIN_NODE_DETAILS[slug] ?? {};
    const missing = names.filter((nm) => !d[nm]);
    if (missing.length) {
      problems.push(`${slug}: 环节结构化维度缺失 → ${missing.join(" ")}`);
      continue;
    }
    for (const nm of names) {
      const v = d[nm];
      const bad: string[] = [];
      if (!v.products) bad.push("products");
      if (!v.value) bad.push("value");
      if (!v.barriers) bad.push("barriers");
      if (!v.metrics?.length) bad.push("metrics");
      if (!v.risks?.length) bad.push("risks");
      if (bad.length) problems.push(`${slug}/${nm}: 维度字段不全 → ${bad.join(",")}`);
    }
    const orphan = Object.keys(d).filter((k) => !names.includes(k));
    if (orphan.length) problems.push(`${slug}: 维度表存在库里没有的环节名 → ${orphan.join(" ")}`);
  }

  /**
   * 全球格局与周期位置。
   * 除字段齐全外，还要查两条硬红线 ——
   *  1) 不能出现国产化率百分比：各报告口径差异极大（产值/产能/装机量），
   *     很多细分环节根本没有公开统计，给一个看似精确的数字比不给更危险。
   *  2) 周期位置必须给 invalidators（什么会推翻这个判断）。
   *     只给结论不给可证伪条件，等于让读者把判断当定论 —— 这是最该防的。
   */
  for (const slug of slugs) {
    const g = ALL_GLOBAL_POSITION[slug];
    if (!g) {
      problems.push(`${slug}: 缺全球格局`);
    } else {
      const bad: string[] = [];
      if (!g.globalRole) bad.push("globalRole");
      if (!g.localization) bad.push("localization");
      if (!g.localizationBlockers?.length) bad.push("localizationBlockers");
      if (!g.keyCompetitors?.length) bad.push("keyCompetitors");
      if (bad.length) problems.push(`${slug}: 全球格局字段不全 → ${bad.join(",")}`);
    }

    const c = ALL_CYCLE[slug];
    if (!c) {
      problems.push(`${slug}: 缺周期位置`);
    } else {
      const bad: string[] = [];
      if (!c.stage) bad.push("stage");
      if (!c.basis?.length) bad.push("basis");
      if (!c.direction) bad.push("direction");
      if (!c.invalidators?.length) bad.push("invalidators");
      if (bad.length) problems.push(`${slug}: 周期位置字段不全 → ${bad.join(",")}`);
    }

    // 硬红线：不得出现国产化率百分比
    const gText = g ? JSON.stringify(g) : "";
    const pct = gText.match(/国产化率?[^\d]{0,6}(\d{1,3})\s*%/);
    if (pct) problems.push(`${slug}: 全球格局出现国产化率数字 → ${pct[0]}`);
  }

console.log(`产业链: ${slugs.length} 条`);
console.log(`岗位总数: ${slugs.reduce((n, x) => n + (ALL_CHAIN_CAREERS[x]?.roles?.length ?? 0), 0)}`);

  /**
   * 代表城市。
   * 硬约束：城市名必须存在于站内城市清单（lib/data/regions）。
   * 写错一个字的后果是死链 —— 而死链比没有这条信息更糟，
   * 因为读者会以为站内没有这个城市的产业链数据。
   */
  const siteCityNames = new Set(
    STATIC_REGIONS.flatMap((r) => r.cities.map((c) => c.name))
  );
  for (const slug of slugs) {
    const list = ALL_CHAIN_CITIES[slug];
    if (!list || !list.length) {
      problems.push(`${slug}: 缺代表城市`);
      continue;
    }
    if (list.length < 3) problems.push(`${slug}: 代表城市少于 3 个`);
    for (const c of list) {
      if (!c.city) {
        problems.push(`${slug}: 代表城市缺 city`);
      } else if (!siteCityNames.has(c.city)) {
        problems.push(`${slug}: 城市「${c.city}」不在站内城市清单 → 会产生死链`);
      }
      if (!c.focus) problems.push(`${slug}/${c.city}: 缺 focus（集聚什么环节）`);
      if (!c.why) problems.push(`${slug}/${c.city}: 缺 why（为什么是这里）`);
    }
    const dup = list.map((c) => c.city).filter((x, i, arr) => arr.indexOf(x) !== i);
    if (dup.length) problems.push(`${slug}: 代表城市重复 → ${[...new Set(dup)].join(" ")}`);
  }

  /** 产业优缺点：优势、劣势、适合谁、不适合谁，四项都不可缺 */
  for (const slug of slugs) {
    const p = ALL_PROS_CONS[slug];
    if (!p) {
      problems.push(`${slug}: 缺产业优缺点`);
      continue;
    }
    const bad: string[] = [];
    if (!p.strengths?.length) bad.push("strengths");
    if (!p.weaknesses?.length) bad.push("weaknesses");
    if (!p.fitFor?.length) bad.push("fitFor");
    if (!p.notFor?.length) bad.push("notFor");
    if (bad.length) problems.push(`${slug}: 优缺点字段不全 → ${bad.join(",")}`);
  }
  if (problems.length) {
    console.log(`\n问题 ${problems.length} 项:`);
    for (const p of problems) console.log("  - " + p);
    process.exitCode = 1;
  } else {
    console.log("\n全部通过：每条链都有利润地图、趋势、驱动力/制约、用人结构、薪资变量与 ≥3 个完整岗位");
  }
}
main();