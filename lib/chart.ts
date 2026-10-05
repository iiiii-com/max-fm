export const CHART = {
  c1: "var(--chart-1)",
  c2: "var(--chart-2)",
  c3: "var(--chart-3)",
  c4: "var(--chart-4)",
  c5: "var(--chart-5)",
  c6: "var(--chart-6)",
  grid: "var(--chart-grid)",
  axis: "var(--chart-axis)",
} as const;

export const CHART_SERIES = [CHART.c1, CHART.c2, CHART.c3, CHART.c4, CHART.c5, CHART.c6];

export const AXIS_TICK = { fill: CHART.axis, fontSize: 10.5 } as const;

export const GRID_PROPS = {
  stroke: CHART.grid,
  strokeDasharray: "2 4",
  vertical: false,
} as const;

export const tooltipStyle = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  padding: "8px 10px",
  fontSize: 12,
  color: "var(--popover-foreground)",
  boxShadow: "0 8px 24px -8px oklch(0.2 0.01 254 / 0.25)",
} as const;

export const cursorStyle = {
  stroke: "var(--border-strong)",
  strokeWidth: 1,
} as const;

export const STATUS_COLORS: Record<string, string> = {
  TODO: CHART.c6,
  IN_PROGRESS: CHART.c1,
  DONE: CHART.c4,
};

export const ATTEND_COLORS: Record<string, string> = {
  NORMAL: CHART.c4,
  LATE: CHART.c3,
};
