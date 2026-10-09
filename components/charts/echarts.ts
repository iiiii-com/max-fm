"use client";

import * as echarts from "echarts/core";
import {
  LineChart, BarChart, ScatterChart, MapChart, GraphChart, CandlestickChart,
  PieChart, RadarChart, GaugeChart, EffectScatterChart, HeatmapChart,
} from "echarts/charts";
import {
  TitleComponent, TooltipComponent, GridComponent, LegendComponent,
  VisualMapComponent, DataZoomComponent, MarkLineComponent, MarkPointComponent,
  GraphicComponent, DatasetComponent, TransformComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

/**
 * 按需注册。**漏注册某个图表类型的失败方式极其隐蔽**：
 * `chart.setOption({ series: [{ type: "heatmap", ... }] })` 不抛错、不报警到页面，
 * 只在 console 留一条 warning，而 `getOption()` 里该 series 的 data 是空的 ——
 * 结果就是坐标轴照常渲染、图形一个都不画，看起来像"数据没取到"。
 * 跨链关系矩阵因此空白过一轮（heatmap 当时没在下面这行里）。
 * 新增图表类型时，务必同时加进 import 与 use()。
 */
echarts.use([
  LineChart, BarChart, ScatterChart, MapChart, GraphChart, CandlestickChart,
  PieChart, RadarChart, GaugeChart, EffectScatterChart, HeatmapChart,
  TitleComponent, TooltipComponent, GridComponent, LegendComponent,
  VisualMapComponent, DataZoomComponent, MarkLineComponent, MarkPointComponent,
  GraphicComponent, DatasetComponent, TransformComponent,
  CanvasRenderer,
]);

export { echarts };
export type { EChartsOption } from "echarts";