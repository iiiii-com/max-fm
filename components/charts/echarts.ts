"use client";

import * as echarts from "echarts/core";
import { LineChart, BarChart, ScatterChart, MapChart, GraphChart } from "echarts/charts";
import {
  TitleComponent, TooltipComponent, GridComponent, LegendComponent,
  VisualMapComponent, DataZoomComponent, MarkLineComponent, MarkPointComponent,
  DatasetComponent, TransformComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

echarts.use([
  LineChart, BarChart, ScatterChart, MapChart, GraphChart,
  TitleComponent, TooltipComponent, GridComponent, LegendComponent,
  VisualMapComponent, DataZoomComponent, MarkLineComponent, MarkPointComponent,
  DatasetComponent, TransformComponent,
  CanvasRenderer,
]);

export { echarts };
export type { EChartsOption } from "echarts";