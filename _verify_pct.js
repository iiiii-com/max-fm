const echarts = require("echarts");
// 用与 mkPctSeries 完全一致的配置，验证 scatter + label 真实渲染涨跌幅
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
const yOf = (i) => {
  const h = bars[i].high ?? bars[i].close;
  return h * 1.004;
};
const chart = echarts.init(null, null, { renderer: "svg", ssr: true, width: 600, height: 300 });
chart.setOption({
  animation: false,
  xAxis: { type: "category", data: bars.map((b) => b.date) },
  yAxis: { scale: true },
  series: [
    {
      name: "K 线",
      type: "candlestick",
      data: ohlc,
      itemStyle: { color: "#dc2626", color0: "#16a34a", borderColor: "#dc2626", borderColor0: "#16a34a" },
    },
    {
      name: "涨跌幅",
      type: "scatter",
      xAxisIndex: 0,
      yAxisIndex: 0,
      symbolSize: 0,
      silent: true,
      z: 5,
      tooltip: { show: false },
      emphasis: { disabled: true },
      data: bars.map((_, i) => [i, yOf(i)]),
      label: {
        show: true,
        position: "top",
        fontSize: 9,
        distance: 1,
        formatter: (p) => {
          const i = p && p.dataIndex != null ? p.dataIndex : 0;
          if (i >= bars.length) return "";
          const pct = pctOf(i);
          if (!pct) return "";
          return (pct > 0 ? "+" : "") + pct.toFixed(2) + "%";
        },
        color: (p) => {
          const i = p && p.dataIndex != null ? p.dataIndex : 0;
          return pctOf(i) >= 0 ? "#dc2626" : "#16a34a";
        },
      },
    },
  ],
});
const svg = chart.renderToSVGString();
const expects = ["+5.00%", "-2.86%", "+8.82%", "-4.50%"];
const found = expects.filter((s) => svg.includes(s));
const allText = [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]).filter((t) => t.includes("%"));
console.log("匹配到的涨跌幅文字:", found.length ? found : "无");
console.log("SVG 中所有含 % 的 text:", JSON.stringify(allText));
