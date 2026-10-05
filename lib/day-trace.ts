/**
 * 「一天的连续轨迹」的纯计算。
 *
 * 现实约束：TimeLog 只存「某天累计几小时」，没有日内起止时间；
 * 真正带日内时间戳的只有 Attendance 的 clockInAt / clockOutAt。
 * 所以轨迹不伪造每段工时的位置 —— 它画的是**在岗区间**，
 * 以及这个区间里有多少被记录、多少漏掉了。漏掉的才是有信息量的部分。
 */

export interface DayTraceInput {
  /** 今日 clockInAt（ISO），未打卡为 null */
  clockInAt: string | null;
  /** 今日 clockOutAt（ISO），未下班为 null */
  clockOutAt: string | null;
  /** 今日已记录工时 */
  loggedHours: number;
  /** 近 N 个工作日的在岗小时数（已剔除无效值），升序 */
  baseline: number[];
  /** 当前时刻，未下班时用它截断在岗区间 */
  now: Date;
}

export type DayTraceState = "idle" | "working" | "closed";

export interface DayTrace {
  state: DayTraceState;
  /** 在岗小时数 */
  onDutyH: number;
  /** 已记录小时数 */
  loggedH: number;
  /** 在岗但未记录的小时数 */
  gapH: number;
  /** 记录覆盖率 0~1 */
  coverage: number;
  /** 近 N 日在岗均值，无历史为 null */
  baselineH: number | null;
  /** 在岗时长 - 基线，无基线为 null */
  deltaH: number | null;
  /** 一句判断。这是这个组件存在的理由：数据本身不回答「所以呢」 */
  verdict: string;
}

const MAX_DUTY_H = 24;
/** 漏记超过这个小时数就值得单独说，而不是混在句尾 */
const GAP_WORTH_SPEAKING = 1.5;

function fmt1(n: number): string {
  return (Math.round(n * 10) / 10).toFixed(1);
}

export function computeDayTrace(input: DayTraceInput): DayTrace {
  const loggedH = Number.isFinite(input.loggedHours)
    ? Math.max(0, input.loggedHours)
    : 0;

  const inMs = input.clockInAt ? Date.parse(input.clockInAt) : NaN;
  const hasIn = Number.isFinite(inMs);

  let state: DayTraceState = "idle";
  let onDutyH = 0;

  if (hasIn) {
    const outMs = input.clockOutAt ? Date.parse(input.clockOutAt) : NaN;
    const endMs = Number.isFinite(outMs) ? outMs : input.now.getTime();
    state = Number.isFinite(outMs) ? "closed" : "working";
    // 打卡时间可能被改坏或跨天，倒挂时按 0 处理，不显示负数
    onDutyH = Math.min(MAX_DUTY_H, Math.max(0, (endMs - inMs) / 3_600_000));
  }

  const gapH = Math.max(0, onDutyH - loggedH);
  const coverage = onDutyH > 0 ? Math.min(1, loggedH / onDutyH) : 0;

  const samples = input.baseline.filter((h) => Number.isFinite(h) && h > 0);
  const baselineH = samples.length
    ? samples.reduce((a, b) => a + b, 0) / samples.length
    : null;
  const deltaH = baselineH === null ? null : onDutyH - baselineH;

  const tail = baselineH
    ? `近 ${samples.length} 日平均在岗 ${fmt1(baselineH)}h`
    : "";

  let verdict: string;
  if (!hasIn) {
    verdict = "今天还没打卡 —— 一天的轨迹要等第一个时间点。";
  } else if (loggedH === 0 && onDutyH >= 1) {
    verdict = `在岗 ${fmt1(onDutyH)}h，一笔都没记。要么真没推进，要么是没记。`;
  } else if (gapH >= GAP_WORTH_SPEAKING) {
    verdict = `在岗 ${fmt1(onDutyH)}h，只记录 ${fmt1(loggedH)}h —— ${fmt1(gapH)}h 掉在时间表外。`;
  } else if (gapH > 0.05) {
    verdict = `在岗 ${fmt1(onDutyH)}h，已记录 ${fmt1(loggedH)}h，还差 ${fmt1(gapH)}h 没记。`;
  } else {
    verdict = `在岗 ${fmt1(onDutyH)}h 已全部记录，没有漏记。`;
  }
  if (tail) verdict += ` ${tail}。`;

  return { state, onDutyH, loggedH, gapH, coverage, baselineH, deltaH, verdict };
}
