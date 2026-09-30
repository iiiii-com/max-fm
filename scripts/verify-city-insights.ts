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