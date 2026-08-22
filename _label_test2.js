const echarts = require("echarts");
const bars = [
  { date: "2026-08-14", open: 10, close: 10.5, high: 10.8, low: 9.9 },
  { date: "2026-08-17", open: 10.5, close: 10.2, high: 10.7, low: 10.1 },
];
const ohlc = bars.map((b) => [b.open, b.close, b.low, b.high]);
const chart = echarts.init(null, null, { renderer: "svg", ssr: true, width: 600, height: 300 });
chart.setOption({
  animation: false,
  xAxis: { type: "category", data: bars.map((b) => b.date) },
  yAxis: { scale: true },
  series: [
    {
      type: "candlestick",
      data: ohlc,
      itemStyle: { color: "#dc2626", color0: "#16a34a", borderColor: "#dc2626", borderColor0: "#16a34a" },
      label: {
        show: true,
        position: "top",
        fontSize: 9,
        formatter: (p) => {
          const i = p && p.dataIndex != null ? p.dataIndex : 0;
          return "TEST-PCT-" + i;
        },
      },
    },
  ],
});
const svg = chart.renderToSVGString();
// 提取所有 <text> 内容
const texts = [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]);
console.log("所有 text 内容:", JSON.stringify(texts));
console.log("包含 TEST-PCT:", svg.includes("TEST-PCT"));
// 也测试 scatter 方式（备选方案）
const chart2 = echarts.init(null, null, { renderer: "svg", ssr: true, width: 600, height: 300 });
chart2.setOption({
  animation: false,
  xAxis: { type: "category", data: bars.map((b) => b.date) },
  yAxis: { scale: true },
  series: [
    { type: "candlestick", data: ohlc, itemStyle: { color: "#dc2626", color0: "#16a34a", borderColor: "#dc2626", borderColor0: "#16a34a" } },
    {
      type: "scatter",
      data: bars.map((b, i) => [i, b.high + 0.3]),
      symbolSize: 1,
      label: { show: true, position: "top", fontSize: 9, formatter: (p) => "SCATTER-" + p.dataIndex },
      tooltip: { show: false },
      silent: true,
    },
  ],
});
const svg2 = chart2.renderToSVGString();
console.log("scatter 方案包含 SCATTER:", svg2.includes("SCATTER"));
