import { getProvinces } from "@/lib/data/queries";
import { SectionTitle } from "@/components/ui";
import ProvinceMap from "@/components/ProvinceMap";
import { bootstrap } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "经济分布图" };

export default async function MapPage() {
  await bootstrap();
  const provinces = await getProvinces();
  const data = provinces.map((p: any) => ({
    name: p.name,
    gdp: p.gdp ?? 0,
    growth: p.growth ?? 0,
    perCapitaGdp: p.perCapitaGdp ?? 0,
    population: p.population ?? 0,
    trade: p.trade ?? 0,
  }));

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 space-y-8">
      <header>
        <h1 className="text-2xl font-bold">中国经济分布图</h1>
        <p className="text-sm text-muted mt-1">31 个省级行政区 · 数据来自各地统计局 · 点击地图查看详情</p>
      </header>

      <section>
        <SectionTitle title="区域经济全景" sub="悬停地图查看数值，切换指标对比区域差异" />
        <ProvinceMap data={data} />
      </section>
    </div>
  );
}