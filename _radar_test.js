const echarts = require("echarts");
// 复刻 RadarChart 的 option 做 SSR 验证
const dims = [
  { name: "盈利能力", max: 10 },
  { name: "成长性", max: 10 },
  { name: "现金流质量", max: 10 },
  { name: "财务稳健", max: 10 },
  { name: "盈利真实性", max: 10 },
];
const series = [
  { name: "优质公司", values: [9, 6, 9, 8, 9], color: "#16a34a" },
  { name: "造假公司", values: [7, 8, 2, 2, 1], color: "#d7000b" },
];
const option = {
  animation: false,
  tooltip: { trigger: "item" },
  legend: { bottom: 0, textStyle: { fontSize: 11 }, data: series.map((s) => s.name) },
  radar: {
    indicator: dims,
    radius: "64%",
    center: ["50%", "46%"],
    axisName: { fontSize: 11, color: "#475569" },
    splitArea: { areaStyle: { color: ["rgba(100,116,139,0.03)", "rgba(100,116,139,0.06)"] } },
    splitLine: { lineStyle: { color: "#e2e8f0" } },
    axisLine: { lineStyle: { color: "#e2e8f0" } },
  },
  series: [
    {
      type: "radar",
      data: series.map((s) => ({
        name: s.name,
        value: s.values,
        lineStyle: { color: s.color, width: 2 },
        itemStyle: { color: s.color },
        areaStyle: { color: s.color, opacity: 0.12 },
        symbolSize: 3,
      })),
    },
  ],
};
try {
  const chart = echarts.init(null, null, { renderer: "svg", ssr: true, width: 500, height: 300 });
  chart.setOption(option);
  const svg = chart.renderToSVGString();
  console.log("radar SSR 渲染成功, SVG 长度:", svg.length);
  console.log("包含盈利能力文字:", svg.includes("盈利能力"));
  console.log("包含系列名:", svg.includes("优质公司") || svg.includes("造假公司"));
} catch (e) {
  console.log("radar SSR 失败:", e.message);
  process.exit(1);
}
