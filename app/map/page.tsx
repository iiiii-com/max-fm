import { getProvinces } from "@/lib/data/queries";
import { SectionTitle, Card } from "@/components/ui";
import ProvinceMap from "@/components/ProvinceMap";
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
  const provinces = await getProvinces();
  const latest = provinces.filter((p: any) => p.year === 2025);
  const data = latest.map((p: any) => ({
    name: NAME_MAP[p.province] ?? p.province,
    gdp: p.gdp ?? 0,
    growth: p.growth ?? 0,
    perCapitaGdp: p.perCapitaGdp ?? 0,
    population: p.population ?? 0,
    trade: p.trade ?? 0,
    fiscalRevenue: p.fiscalRevenue ?? 0,
  }));

  const totalGdp = fmt1(data.reduce((s: number, d: any) => s + d.gdp, 0));
  const totalTrade = fmt1(data.reduce((s: number, d: any) => s + d.trade, 0));
  const totalPop = fmt1(data.reduce((s: number, d: any) => s + d.population, 0));
  const avgGrowth = fmt1(data.reduce((s: number, d: any) => s + d.growth, 0) / Math.max(data.length, 1));
  const richest = [...data].sort((a, b) => b.perCapitaGdp - a.perCapitaGdp)[0];

  const summary = [
    { label: "31 省 GDP 合计", value: `${totalGdp} 万亿`, note: "占全国总量约 9 成" },
    { label: "平均 GDP 增速", value: `${avgGrowth}%`, note: "2025 年省级均值" },
    { label: "外贸合计", value: `${totalTrade} 万亿`, note: "进出口总额加总" },
    { label: "人口合计", value: `${totalPop} 亿`, note: "常住人口加总" },
    { label: "人均 GDP 最高", value: richest?.name ?? "—", note: `${fmt1(richest?.perCapitaGdp ?? 0)} 万元` },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 space-y-8">
      <header>
        <h1 className="text-2xl font-bold">中国经济分布图</h1>
        <p className="text-sm text-muted mt-1">31 个省级行政区 · 数据来自各地统计局 · 点击地图查看详情</p>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {summary.map((s) => (
          <Card key={s.label} className="p-4">
            <p className="text-xs text-muted">{s.label}</p>
            <p className="font-bold text-lg mt-1 truncate">{s.value}</p>
            <p className="text-[11px] text-muted mt-0.5">{s.note}</p>
          </Card>
        ))}
      </section>

      <section>
        <SectionTitle title="区域经济全景" sub="悬停地图查看数值与排名，切换指标对比区域差异，表格点击表头排序" />
        <ProvinceMap data={data} />
      </section>
    </div>
  );
}