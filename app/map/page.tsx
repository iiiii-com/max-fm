import { getProvinces, getProvinceHistoryAll } from "@/lib/data/queries";
import { SectionTitle, Card } from "@/components/ui";
import ProvinceMap from "@/components/ProvinceMap";
import CityRankTable, { ProvinceCityPanel } from "@/components/CityRankTable";
import ProvinceEconomyAnalysis from "@/components/industry/ProvinceEconomyAnalysis";
import CityIndustryMap from "@/components/CityIndustryMap";
import CityGraphBoard from "@/components/CityGraphBoard";
import { bootstrap } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "经济分布图" };

const NAME_MAP: Record<string, string> = {
  北京: "北京市", 天津: "天津市", 河北: "河北省", 山西: "山西省", 内蒙古: "内蒙古自治区",
  辽宁: "辽宁省", 吉林: "吉林省", 黑龙江: "黑龙江省", 上海: "上海市", 江苏: "江苏省",
  浙江: "浙江省", 安徽: "安徽省", 福建: "福建省", 江西: "江西省", 山东: "山东省",
  河南: "河南省", 湖北: "湖北省", 湖南: "湖南省", 广东: "广东省", 广西: "广西壮族自治区",
  海南: "海南省", 重庆: "重庆市", 四川: "四川省", 贵州: "贵州省", 云南: "云南省",
  西藏: "西藏自治区", 陕西: "陕西省", 甘肃: "甘肃省", 青海: "青海省",
  宁夏: "宁夏回族自治区", 新疆: "新疆维吾尔自治区",
};

const fmt1 = (v: number) => Math.round(v * 10) / 10;

export default async function MapPage() {
  await bootstrap();
  const [provinces, historyAll] = await Promise.all([getProvinces(), getProvinceHistoryAll()]);
  const latest = provinces.filter((p: any) => p.year === 2025);
  // trade / fiscalRevenue 已下线：seed 阶段这两个字段是 rng() 随机数
  // （trade = gdp × (0.25 + rng()×0.4)），与真实省级统计无关，已由
  // scripts/fix-province-fake-data.ts 置空。详见 components/ProvinceMap.tsx 顶部注释。
  const data = latest.map((p: any) => ({
    name: NAME_MAP[p.province] ?? p.province,
    gdp: p.gdp ?? 0,
    growth: p.growth ?? 0,
    perCapitaGdp: p.perCapitaGdp ?? 0,
    population: p.population ?? 0,
  }));
  const history = historyAll.map((h: any) => ({
    name: NAME_MAP[h.province] ?? h.province,
    year: h.year,
    gdp: h.gdp ?? 0,
    growth: h.growth ?? 0,
    perCapitaGdp: h.perCapitaGdp ?? 0,
    population: h.population ?? 0,
  }));

  const totalGdp = fmt1(data.reduce((s: number, d: any) => s + d.gdp, 0));
  const totalPop = fmt1(data.reduce((s: number, d: any) => s + d.population, 0));
  const avgGrowth = fmt1(data.reduce((s: number, d: any) => s + d.growth, 0) / Math.max(data.length, 1));
  const richest = [...data].sort((a: any, b: any) => b.perCapitaGdp - a.perCapitaGdp)[0];
  // 省级加总口径提示：31 省 GDP 相加与全国 GDP 并不相等（统计口径、普查修订、省级与全国核算方法差异），
  // 因此**不展示**「占全国约 X 成」这类需要全国总量才能算、而站内并无全国总量数据的比例。
  const gdpSumNote = "31 省相加口径，不等于全国 GDP";

  const summary = [
    { label: "31 省 GDP 合计", value: `${totalGdp} 万亿`, note: gdpSumNote },
    { label: "平均 GDP 增速", value: `${avgGrowth}%`, note: "2025 年省级算术均值（非加权）" },
    { label: "人口合计", value: `${totalPop} 亿`, note: "常住人口加总" },
    { label: "人均 GDP 最高", value: richest?.name ?? "—", note: `${fmt1(richest?.perCapitaGdp ?? 0)} 万元` },
  ];

  return (
    <div className="mx-auto max-w-7xl px-3 sm:px-4 py-5 sm:py-6 space-y-8">
      <header>
        <h1 className="text-2xl font-bold">中国经济分布图</h1>
        <p className="text-sm text-muted mt-1">31 个省级行政区 · 数据来自各地统计局 · 点击地图查看详情</p>
        <p className="text-[11px] text-muted mt-2 leading-relaxed border-l-2 border-amber-500/50 pl-2.5">
          <b className="text-amber-600 dark:text-amber-400">数据口径说明：</b>
          GDP / 增速 / 人口为 2025 年基值；<b>2018-2024 年为按增长率倒推并叠加扰动的推算值</b>，不具备逐年可核验性。
          「进出口」与「财政收入」两个维度<b className="text-amber-600 dark:text-amber-400">已下线</b>——
          它们此前由随机数生成，排名与真实情况完全相反；无可核验公开数据前不展示。
          本页所有比例的分子分母同为 31 省口径，<b>不含「占全国 X 成」</b>（全国口径数据站内没有）。
        </p>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {summary.map((s) => (
          <Card key={s.label} className="p-4">
            <p className="text-xs text-muted">{s.label}</p>
            <p className="font-bold text-lg mt-1 truncate">{s.value}</p>
            <p className="text-[11px] text-muted mt-0.5">{s.note}</p>
          </Card>
        ))}
      </section>

      <section>
        <SectionTitle title="区域经济全景" sub="悬停地图查看数值与排名，切换指标对比区域差异，表格点击表头排序；点击省份或表格行查看 2018-2025 走势" />
        <ProvinceMap data={data} history={history} />
      </section>

      <ProvinceEconomyAnalysis rows={data} />

      <section>
        <SectionTitle
          title="核心城市产业图谱 · 网络视图"
          sub="以城市为节点的产业关联图谱：节点大小=产业规模，颜色=产业类型，连线=同产业关联；悬停可看城市性格摘要，点击节点展开产业解读与产业链关系"
        />
        <CityGraphBoard />
      </section>

      <section>
        <SectionTitle
          title="核心城市产业图谱 · 地图视图"
          sub="在全国地图上标注核心城市地理位置（经纬度），点击气泡查看该城市支柱产业、产业优势、代表企业与产业解读，并可跳转完整解读"
        />
        <CityIndustryMap />
      </section>

      <section>
        <SectionTitle title="代表城市" sub="点击省份查看城市分布；每张卡片含产业定位首句与主要取舍，产业标签可跳转对应产业链，点击卡片看完整解读" />
        <ProvinceCityPanel />
      </section>

      <section>
        <SectionTitle title="全国城市 GDP 榜" sub="TOP30 城市 · 2025 年口径预估 · 点击表头排序 · 每城附解读摘要" />
        <Card>
          <CityRankTable />
        </Card>
      </section>
    </div>
  );
}