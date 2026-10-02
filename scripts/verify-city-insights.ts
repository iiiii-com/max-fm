import { CITY_INSIGHTS } from "../lib/data/cityInsights";
import type { CityInsight } from "../lib/data/cityInsightsTypes";
import { GUANGDONG } from "../lib/data/cityInsights/guangdong";
import { JIANGSU_ZHEJIANG_SHANDONG } from "../lib/data/cityInsights/jiangsuZhejiangShandong";
import { SICHUAN_HUBEI_FUJIAN_ANHUI_HUNAN_HENAN } from "../lib/data/cityInsights/sichuanHubeiFujianAnhuiHunanHenan";
import { NORTHWEST_MUNICIPALS_NORTHEAST } from "../lib/data/cityInsights/northwestMunicipalsNortheast";
import { JIANGXI_GUIZHOU_YUNNAN } from "../lib/data/cityInsights/jiangxiGuizhouYunnan";
import { GUANGXI_INNERMONGOLIA_GANSU_QINGHAI_TIBET } from "../lib/data/cityInsights/guangxiInnerMongoliaGansuQinghaiTibet";
import { STATIC_REGIONS } from "../lib/data/regions";

const all = STATIC_REGIONS.flatMap((r) => r.cities);
console.log("城市总数:", all.length, "| 已有解读:", Object.keys(CITY_INSIGHTS).length);

const missing = all.map((c) => c.name).filter((n) => !CITY_INSIGHTS[n]);
console.log("待补:", missing.length, "->", missing.join(" "));

const orphan = Object.keys(CITY_INSIGHTS).filter((k) => !all.some((c) => c.name === k));
console.log("孤儿:", orphan.join(",") || "无");

// 重名覆盖检测：批次用 Object.assign 汇总，同名城市后写入者会**静默**覆盖前者。
// 这类 bug 不会报错、不会崩，只会让某座城市的解读悄悄变成另一个城市的。
// 因此这里比对「各批次声明数之和」与「汇总后去重数」，不等即说明发生了覆盖。
const BATCHES: Array<[string, Record<string, CityInsight>]> = [
  ["guangdong", GUANGDONG],
  ["jiangsuZhejiangShandong", JIANGSU_ZHEJIANG_SHANDONG],
  ["sichuanHubeiFujianAnhuiHunanHenan", SICHUAN_HUBEI_FUJIAN_ANHUI_HUNAN_HENAN],
  ["northwestMunicipalsNortheast", NORTHWEST_MUNICIPALS_NORTHEAST],
  ["jiangxiGuizhouYunnan", JIANGXI_GUIZHOU_YUNNAN],
  ["guangxiInnerMongoliaGansuQinghaiTibet", GUANGXI_INNERMONGOLIA_GANSU_QINGHAI_TIBET],
];
const batchTotal = BATCHES.reduce((a, [, b]) => a + Object.keys(b).length, 0);
console.log(
  `批次 ${BATCHES.length} 个，声明合计 ${batchTotal} / 汇总去重后 ${Object.keys(CITY_INSIGHTS).length}` +
    (batchTotal === Object.keys(CITY_INSIGHTS).length ? "（无覆盖）" : "  ← 存在同名覆盖！")
);

// 批次之间也不允许出现同名城市（跨批次重复同样会静默覆盖）
for (let i = 0; i < BATCHES.length; i++) {
  for (let j = i + 1; j < BATCHES.length; j++) {
    const dup = Object.keys(BATCHES[i][1]).filter((k) => BATCHES[j][1][k]);
    if (dup.length) console.log(`  ⚠ 批次 ${BATCHES[i][0]} 与 ${BATCHES[j][0]} 重复: ${dup.join(",")}`);
  }
}

const bad = Object.entries(CITY_INSIGHTS).filter(
  ([, v]: any) =>
    !v.industry ||
    !v.character ||
    !v.jobs?.structure ||
    v.jobs?.directions?.length < 3 ||
    !v.jobs?.caveat ||
    !v.income?.drivers ||
    !v.income?.structure ||
    !v.income?.source ||
    !v.cost?.housing ||
    !v.cost?.living ||
    !v.cost?.source ||
    v.pros?.length < 3 ||
    v.cons?.length < 3 ||
    !v.life?.strengths?.length ||
    !v.life?.tradeoffs?.length ||
    !v.life?.fitFor?.length
);
console.log("字段不全:", bad.map((b) => b[0]).join(",") || "无");

// 反向检查：不得出现任何疑似编造的数字（薪资/房价/就业率）
const risky = /平均年薪|年薪\s*\d|房价均价|均价\s*\d+\s*万|就业率\s*\d|人均可支配收入\s*\d/;
const withNumbers = Object.entries(CITY_INSIGHTS).filter(([, v]: any) =>
  risky.test(v.income?.drivers ?? "") ||
  risky.test(v.income?.structure ?? "") ||
  risky.test(v.cost?.housing ?? "") ||
  risky.test(v.cost?.living ?? "")
);
console.log("疑似编造数值:", withNumbers.map((w) => w[0]).join(",") || "无");

/**
 * 跨城重复分句检查 —— 专治模板味。
 *
 * 结构校验只保证字段齐全与数值可信，"房价低，居住空间大"这种整句照抄
 * 照样全绿，但读者一眼就看出是套话。这里把 67 城的文案按分句比对，
 * 找出在不同城市间复用的句子。
 *
 * 例外（ALLOWED_REPEAT）：这些句子重复是事实而非套话 ——
 * 它们描述数据可得性，而这些城市确实都没有官方房价指数。
 */
const ALLOWED_REPEAT = new Set([
  "房价无官方城市级指数可参考",
  "不在统计局 70 城房价统计范围内",
  "有官方房价指数（统计局 70 城）",
]);

const buckets = new Map<string, Set<string>>();
for (const [city, v] of Object.entries(CITY_INSIGHTS) as [string, CityInsight][]) {
  const texts: string[] = [
    v.industry, v.character,
    v.jobs?.structure ?? "", v.jobs?.caveat ?? "",
    v.income?.drivers ?? "", v.income?.structure ?? "",
    v.cost?.housing ?? "", v.cost?.living ?? "",
    ...(v.pros ?? []), ...(v.cons ?? []),
    ...(v.life?.tradeoffs ?? []), ...(v.life?.fitFor ?? []),
  ];
  for (const t of texts) {
    for (const s of t.split(/[。！？；]/).map((x) => x.trim()).filter((x) => x.length >= 8)) {
      if (!buckets.has(s)) buckets.set(s, new Set());
      buckets.get(s)!.add(city);
    }
  }
}
const repeated = [...buckets]
  .filter(([s, cities]) => cities.size >= 3 && !ALLOWED_REPEAT.has(s))
  .sort((a, b) => b[1].size - a[1].size);
if (repeated.length) {
  console.log(`跨城重复分句 ${repeated.length} 处（≥3 城复用，判为套话）:`);
  for (const [s, cities] of repeated) console.log(`  [${cities.size}城] ${s.slice(0, 40)} — ${[...cities].join(" ")}`);
} else {
  console.log("跨城重复分句: 无（≥3 城复用；两城同质属正常，不报）");
}