"use client";

/* ============================================================
   KonratiefWaveChart —— 康德拉季耶夫长波 · 形象化波浪曲线
   六波连续「生命周期」波浪（回升→繁荣→衰退→萧条），波峰标注技术革命，
   危机散点标注（1825/1873/1929/1973/2008），当前位置竖线。
   点击波次 → 下方详情联动（数据源：/data/konratief.json，真实史实）。
   ============================================================ */
import { useMemo, useState } from "react";
import EChart from "@/components/charts/EChart";
import type { EChartsOption } from "echarts";
import type { KonratiefWave } from "@/components/KonratiefWaves";

const WAVE_COLORS = ["#4dd0e1", "#4ade80", "#fbbf24", "#ff8a8c", "#f28c00", "#b39ddb"];
/** 各波著名的崩盘/萧条起点（康波理论的经典危机坐标） */
const CRISIS_MARKS = [
  { year: 1825, label: "1825 英国首次现代金融危机" },
  { year: 1873, label: "1873 长萧条开端" },
  { year: 1929, label: "1929 大萧条" },
  { year: 1973, label: "1973 石油危机·滞胀" },
  { year: 2008, label: "2008 全球金融危机" },
];

function parseYears(years: string): [number, number] {
  const m = years.match(/(\d{4})\s*[—–-]\s*(\d{4})/);
  return m ? [Number(m[1]), Number(m[2])] : [1782, 1845];
}

/** 生成一波的「生命周期」曲线：回升→繁荣(峰)→衰退→萧条，峰在 55% 处，用平滑样条点 */
function waveCurve(start: number, end: number, peak = 1): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  const span = end - start;
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    const year = Math.round(start + t * span);
    // 不对称生命周期：升段缓（0→55%），峰部平台，降段陡后趋缓
    let v: number;
    if (t < 0.55) v = Math.sin((t / 0.55) * (Math.PI / 2));
    else v = Math.cos(((t - 0.55) / 0.45) * (Math.PI / 2)) * 0.92 + 0.08;
    pts.push([year, Math.round(v * peak * 100) / 100]);
  }
  return pts;
}

export default function KonratiefWaveChart({ waves }: { waves: KonratiefWave[] }) {
  const [sel, setSel] = useState<number>(waves.length - 1);

  const { option, years } = useMemo(() => {
    const all: Array<[number, number]> = [];
    const series: any[] = [];
    let cursor = 1782;
    waves.forEach((w, i) => {
      const [s, e] = parseYears(w.years);
      const start = Math.max(cursor - 4, s - 4); // 波间小幅重叠，形似接力
      const curve = waveCurve(start, e, 1);
      cursor = e;
      all.push(...curve);
      series.push({
        name: `${w.no} · ${w.name}`,
        type: "line",
        smooth: 0.6,
        showSymbol: false,
        data: curve,
        lineStyle: { width: sel === i ? 3 : 1.6, color: WAVE_COLORS[i % WAVE_COLORS.length], opacity: sel === i ? 1 : 0.55 },
        areaStyle: {
          color: {
            type: "linear", x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: WAVE_COLORS[i % WAVE_COLORS.length] + (sel === i ? "55" : "26") },
              { offset: 1, color: WAVE_COLORS[i % WAVE_COLORS.length] + "00" },
            ],
          },
        },
        z: sel === i ? 5 : 2,
      });
    });

    const markLineData: any[] = [
      {
        xAxis: 2026,
        lineStyle: { color: "#f28c00", type: "solid", width: 1.5 },
        label: { formatter: "当前位置 2026", position: "insideEndTop", color: "#f28c00", fontSize: 11, fontWeight: 700 },
      },
    ];
    const markPoints = CRISIS_MARKS.map((c) => ({
      coord: [c.year, 0.02],
      symbol: "pin",
      symbolSize: 30,
      itemStyle: { color: "#ff4d4f" },
      label: { show: false },
      value: c.label,
    }));
    // 波峰标注：每波峰位标「波次·核心技术」
    const peakMarks = waves.map((w, i) => {
      const [s, e] = parseYears(w.years);
      const prevEnd = i > 0 ? parseYears(waves[i - 1].years)[1] : s;
      const start = Math.max(prevEnd - 4, s - 4);
      return {
        coord: [Math.round(start + 0.55 * (e - start)), 0.97],
        value: `${w.no}·${w.name}`,
        symbol: "circle", symbolSize: 6,
        label: {
          show: true, formatter: `${w.no}·${w.tech.split(" ·")[0]}`,
          position: "top", fontSize: 10, fontWeight: 700,
          color: WAVE_COLORS[i % WAVE_COLORS.length],
        },
        itemStyle: { color: WAVE_COLORS[i % WAVE_COLORS.length] },
      };
    });

    const option: EChartsOption = {
      title: { text: "康德拉季耶夫长波（1782—2040）· 六波技术革命周期", left: 12, top: 6, textStyle: { fontSize: 14, fontWeight: 600 } },
      tooltip: {
        trigger: "axis",
        formatter: (ps: any) => {
          const arr = Array.isArray(ps) ? ps : [ps];
          const year = arr[0]?.axisValue;
          const hit = waves.find((w) => {
            const [s, e] = parseYears(w.years);
            return year >= s - 4 && year <= e;
          });
          const crisis = CRISIS_MARKS.find((c) => c.year === year);
          let html = `<b>${year}</b>`;
          if (hit) html += `<br/>${hit.no} ${hit.name}（${hit.years}）<br/><span style="color:#8a8a8a">技术：${hit.tech}</span>`;
          if (crisis) html += `<br/><span style="color:#ff4d4f">◉ ${crisis.label}</span>`;
          return html;
        },
      },
      grid: { left: 44, right: 20, top: 46, bottom: 30 },
      xAxis: {
        type: "value", min: 1770, max: 2045,
        axisLabel: { fontSize: 10, formatter: (v: number) => String(v) },
        splitLine: { show: false },
      },
      yAxis: {
        type: "value", min: 0, max: 1.15,
        axisLabel: { show: false }, splitLine: { show: false },
        axisLine: { show: false }, axisTick: { show: false },
      },
      series: [
        ...series,
        {
          /* 当前位置竖线（markLine，挂空 series） */
          name: "当前位置", type: "line", data: [],
          markLine: { silent: true, symbol: "none", data: markLineData },
          z: 9,
        },
        {
          /* 波峰与危机标注（markPoint，value 必填避免内部读 coord 报错） */
          name: "周期标注", type: "line", data: [],
          markPoint: { silent: false, data: [...peakMarks, ...markPoints] },
          z: 10,
        },
      ],
    };
    return { option, years: all };
  }, [waves, sel]);

  // 波峰标注：用 markPoint 挂在第一条 series 上更省事
  const active = waves[sel];

  return (
    <div>
      <EChart option={option} height={360} />
      <div className="flex flex-wrap gap-2 mt-3">
        {waves.map((w, i) => (
          <button
            key={w.no}
            onClick={() => setSel(i)}
            className={`gmt-chip px-3 py-1.5 rounded-md text-xs border transition-colors ${sel === i ? "on" : ""}`}
            style={sel === i ? { background: WAVE_COLORS[i % WAVE_COLORS.length], borderColor: WAVE_COLORS[i % WAVE_COLORS.length], color: "#000", fontWeight: 700 } : { borderColor: "var(--line-strong)", color: "var(--fg-dim)" }}
            aria-pressed={sel === i}
          >
            <span className="font-mono mr-1.5">{w.years}</span>
            {w.name}
          </button>
        ))}
      </div>
      {active && (
        <div className="mt-4 p-4 rounded-md border" style={{ borderColor: "var(--line-strong)", background: "var(--bg-raise)" }}>
          <div className="flex items-center gap-2 flex-wrap">
            <b style={{ color: WAVE_COLORS[sel % WAVE_COLORS.length] }}>{active.no} · {active.name}</b>
            <span className="font-mono text-xs" style={{ color: "var(--muted)" }}>{active.years}</span>
            <span className="text-xs" style={{ color: "var(--muted)" }}>核心技术：{active.tech}</span>
          </div>
          <p className="text-sm leading-relaxed mt-2" style={{ color: "var(--fg)" }}>{active.detail}</p>
          <p className="text-xs mt-2" style={{ color: "var(--muted)" }}>主导产业：{active.sector} · 核心国家：{active.countries}</p>
        </div>
      )}
      <p className="text-[11px] mt-3" style={{ color: "var(--fg-faint)" }}>
        波形为「技术景气度」的形象化示意（非实际指数）：每波按回升→繁荣→衰退→萧条的生命周期绘制，峰位约在波次 55% 处；
        红色标点为康波理论经典危机坐标。划分依据 Nikolaï Kondratieff（1925）与后续熊彼特/佩雷斯学派主流划分，各派起止年份存在 ±5 年差异。
      </p>
    </div>
  );
}
