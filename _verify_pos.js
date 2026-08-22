const echarts = require("echarts");
const bars = [
  { date: "2026-08-14", open: 10, close: 10.5, high: 10.8, low: 9.9 },
  { date: "2026-08-17", open: 10.5, close: 10.2, high: 10.7, low: 10.1 },
  { date: "2026-08-18", open: 10.2, close: 11.1, high: 11.2, low: 10.15 },
  { date: "2026-08-19", open: 11.1, close: 10.6, high: 11.3, low: 10.5 },
];
const ohlc = bars.map((b) => [b.open, b.close, b.low, b.high]);
const pctOf = (i) => {
  const prev = i > 0 ? bars[i - 1].close : bars[i].open;
  return ((bars[i].close - prev) / prev) * 100;
};
const yOf = (i) => (bars[i].high ?? bars[i].close) * 1.006;
const chart = echarts.init(null, null, { renderer: "svg", ssr: true, width: 800, height: 300 });
chart.setOption({
  animation: false,
  xAxis: { type: "category", data: bars.map((b) => b.date) },
  yAxis: { scale: true },
  series: [
    { name: "K线", type: "candlestick", data: ohlc, itemStyle: { color: "#dc2626", color0: "#16a34a", borderColor: "#dc2626", borderColor0: "#16a34a" } },
    {
      name: "涨跌幅", type: "scatter", xAxisIndex: 0, yAxisIndex: 0, symbolSize: 0, silent: true, z: 5,
      tooltip: { show: false }, emphasis: { disabled: true },
      data: bars.map((b, i) => [b.date, yOf(i)]),
      label: {
        show: true, position: "top", fontSize: 9, distance: 1,
        formatter: (p) => { const i = p ? p.dataIndex : 0; const v = pctOf(i); return (v > 0 ? "+" : "") + v.toFixed(2) + "%"; },
        color: (p) => pctOf(p ? p.dataIndex : 0) >= 0 ? "#dc2626" : "#16a34a",
      },
    },
  ],
});
const svg = chart.renderToSVGString();
// 提取涨跌幅 text 及其 x 坐标
const texts = [...svg.matchAll(/<text[^>]*x="([\d.]+)"[^>]*>([^<]*%[^<]*)<\/text>/g)].map((m) => ({ x: parseFloat(m[1]), t: m[2].trim().slice(-9) }));
console.log("涨跌幅标注坐标:", JSON.stringify(texts, null, 1));
if (texts.length === 4) {
  const xs = texts.map((t) => t.x);
  const sorted = [...xs].sort((a, b) => a - b);
  const spaced = sorted.every((x, i) => i === 0 || x - sorted[i - 1] > 30);
  console.log("4 个标注分散且不重叠:", spaced ? "是 ✅" : "否 ❌", "x 范围:", xs[0].toFixed(0), "-", xs[3].toFixed(0));
} else {
  console.log("标注数量异常:", texts.length);
}
