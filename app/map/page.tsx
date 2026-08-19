import { getProvinces } from "@/lib/data/queries";
import { SectionTitle } from "@/components/ui";
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

export default async function MapPage() {
  await bootstrap();
  const provinces = await getProvinces();
  const data = provinces.map((p: any) => ({
    name: NAME_MAP[p.province] ?? p.province,
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