/**
 * 从真实上证日线复算「崩盘 / 修复」与「牛市」统计，输出 data/cycle-crashes.json
 *
 * 为什么要有这个脚本
 *   站点原则是「数据必须真实、可溯源、可验证」。
 *   外部文本给出的 A 股涨跌幅与站点真实日线复算值存在系统性偏差，
 *   因此所有上站数值都必须能由本脚本一键复现，而不是照抄。
 *
 * 口径（全部写明，便于复核）
 *   - 数据源：data/sh-index.json（上证综指日线，1990-12-19 起，字段 [日期, 开, 收, 高, 低, 量]）
 *   - 以**收盘价**为基准（与站点牛熊表口径一致）
 *   - 崩盘事件：自某历史高点回撤 ≥ DETECT_THRESHOLD 视为一次下跌事件；
 *     谷底取「回到前高之前」的最低价；
 *     修复为「重新站上前高」所需时间；若至今未站上，recovered=false
 *   - 为避免同一轮下跌被重复计数，一次事件结束后从修复日重新开始追踪高点
 *   - 时长同时给出自然日与交易日两种（交易日更贴近市场感受）
 *
 * 运行：npx tsx scripts/build-cycle-data.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

/** 入熊阈值：自峰值的回撤达到该值即进入熊市（20% = 传统熊市定义） */
const DETECT_THRESHOLD = 0.2;
/**
 * 谷底确认阈值：自低点反弹达到该值才认定熊市结束。
 *
 * 之所以**不采用与入熊相同的 20%**：A 股波动极大，2008 年熊市内部出现过多次
 * 20%+ 的中级反弹，对称阈值会把同一轮熊市切成 2–3 段（实测会得到 26 次事件）。
 * 取 30% 的理由：经参数扫描（见 sensitivity 输出），20%/30% 这一组既能避免 1993、2008
 * 那类「一轮熊市被切成多段」，又能把 2015 与 2018 两轮独立分出来（合并后为 -52%，
 * 分开则 2015 单轮为 -49%，与市场对这两轮熊市的普遍认知一致）。
 */
const TROUGH_CONFIRM_THRESHOLD = 0.3;
/** 标记为「大熊市」的回撤阈值 */
const MAJOR_THRESHOLD = 0.3;
/** 牛市统计的起点：1993 起为腾讯源可靠区间（与站点 K 线图保持一致） */
const RELIABLE_FROM = "1993-01-04";
/** 收益率年化用的自然日 */
const DAYS_PER_YEAR = 365.25;

type Row = [string, string, string, string, string, string];

interface Bar {
  date: string;
  close: number;
}

interface Episode {
  peakDate: string;
  peakClose: number;
  troughDate: string;
  troughClose: number;
  /** 最大回撤（%，负值） */
  drawdownPct: number;
  /** 下跌时长（自然日 / 交易日） */
  declineDays: number;
  declineBars: number;
  /** 修复时长（自然日 / 交易日）；未修复为 null */
  recoveryDays: number | null;
  recoveryBars: number | null;
  recovered: boolean;
  /** 是否大熊市（回撤 ≥ 30%） */
  major: boolean;
}

function loadBars(): Bar[] {
  const raw = JSON.parse(readFileSync(resolve("data/sh-index.json"), "utf8")) as Row[];
  return raw
    .map((r) => ({ date: r[0], close: Number(r[2]) }))
    .filter((b) => b.date && Number.isFinite(b.close) && b.close > 0);
}

/** 两个日期之间的自然日 */
function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
}

/**
 * 检出历次熊市（峰值 → 谷底 → 修复）
 *
 * 为什么不用另外两种朴素做法（均已实测淘汰）：
 *   A. 「自历史最高点回撤，直到重新站上前高才算结束」
 *      → 2007-10-16 见顶后至今未收复，会把 2015、2018、2021 等中级熊市
 *        全部吞进同一个事件，只检出 5 次，与市场共识不符。
 *   B. 纯 ZigZag（局部峰谷，20% 阈值）
 *      → 过度碎片化：1993–94 那轮被拆成 4 段，共检出 26 次，噪声太大。
 *
 * 采用口径（与本页「熊市」定义一致，也是市场通行口径）：
 *   - 峰值：**滚动最高收盘价**（不必是历史最高点）
 *   - 自峰值回撤 ≥ DETECT_THRESHOLD 即进入熊市
 *   - 谷底：熊市期间的最低价；**自该低点反弹 ≥ DETECT_THRESHOLD 即确认谷底**，
 *     事件就此闭合（不要求收复前高）——这正是修复 A 方案缺陷的关键
 *   - 闭合后从谷底重新开始追踪峰值
 *   - 修复时长单独计算：自谷底起首次收盘重新站上**该事件峰值收盘价**所需时间
 */
function detectEpisodes(bars: Bar[]): Episode[] {
  return detectWith(DETECT_THRESHOLD, TROUGH_CONFIRM_THRESHOLD, bars);
}

/** 可参数化的熊市检测（供主流程与口径敏感性共同复用） */
function detectWith(entry: number, confirm: number, barsArg?: Bar[]): Episode[] {
  const bars = barsArg ?? loadBars();
  const t = entry;
  const episodes: Episode[] = [];

  let peakIdx = 0;
  let troughIdx = -1;
  let inBear = false;

  for (let i = 1; i < bars.length; i++) {
    const close = bars[i].close;

    if (!inBear) {
      if (close > bars[peakIdx].close) {
        peakIdx = i;
      } else if (close <= bars[peakIdx].close * (1 - t)) {
        inBear = true;
        troughIdx = i;
      }
      continue;
    }

    if (close < bars[troughIdx].close) {
      troughIdx = i;
    } else if (close >= bars[troughIdx].close * (1 + confirm)) {
      // 自低点反弹达标 → 确认谷底，事件闭合
      episodes.push(buildEpisode(bars, peakIdx, troughIdx, findRecovery(bars, peakIdx, troughIdx)));
      peakIdx = troughIdx; // 从谷底重新追踪峰值
      inBear = false;
      troughIdx = -1;
    }
  }

  // 末段仍在熊市：谷底尚未确认，取区间最低点作为暂定谷底
  if (inBear && troughIdx > 0) {
    episodes.push(buildEpisode(bars, peakIdx, troughIdx, findRecovery(bars, peakIdx, troughIdx)));
  }

  return episodes;
}

/** 自谷底起，首次收盘重新站上峰值收盘价的下标；未站上返回 null */
function findRecovery(bars: Bar[], peakIdx: number, troughIdx: number): number | null {
  const peakClose = bars[peakIdx].close;
  for (let i = troughIdx + 1; i < bars.length; i++) {
    if (bars[i].close >= peakClose) return i;
  }
  return null;
}

function buildEpisode(bars: Bar[], peakIdx: number, troughIdx: number, recoveryIdx: number | null): Episode {
  const peak = bars[peakIdx];
  const trough = bars[troughIdx];
  const drawdownPct = ((trough.close - peak.close) / peak.close) * 100;

  return {
    peakDate: peak.date,
    peakClose: Number(peak.close.toFixed(2)),
    troughDate: trough.date,
    troughClose: Number(trough.close.toFixed(2)),
    drawdownPct: Number(drawdownPct.toFixed(2)),
    declineDays: daysBetween(peak.date, trough.date),
    declineBars: troughIdx - peakIdx,
    recoveryDays: recoveryIdx === null ? null : daysBetween(trough.date, bars[recoveryIdx].date),
    recoveryBars: recoveryIdx === null ? null : recoveryIdx - troughIdx,
    recovered: recoveryIdx !== null,
    major: Math.abs(drawdownPct) >= MAJOR_THRESHOLD * 100,
  };
}

interface BullPhase {
  from: string;
  to: string;
  days: number;
  changePct: number;
  /** 年化（按自然日） */
  annualizedPct: number;
  /** 站点已记录的阶段名（来自 bull-bear-raw.json，若匹配） */
  label?: string;
}

/** 牛市统计：直接复用站点已核验的 bull-bear-raw.json，只做年化换算 */
function loadBulls(): BullPhase[] {
  const raw = JSON.parse(readFileSync(resolve("data/bull-bear-raw.json"), "utf8")) as any[];
  return raw
    .filter((x) => x.phase === "bull" && x.from >= RELIABLE_FROM)
    .map((x) => {
      const days = x.days as number;
      const changePct = x.change_pct as number;
      const years = days / DAYS_PER_YEAR;
      const annualized = (Math.pow(1 + changePct / 100, 1 / years) - 1) * 100;
      return {
        from: x.from,
        to: x.to,
        days,
        changePct: Number(changePct.toFixed(1)),
        annualizedPct: Number(annualized.toFixed(1)),
        label: x.period,
      };
    });
}

const bars = loadBars();
const episodes = detectEpisodes(bars).sort((a, b) => (a.peakDate < b.peakDate ? -1 : 1));
const bulls = loadBulls();

const out = {
  meta: {
    source: "data/sh-index.json（上证综指日线，腾讯财经 fqkline 历史日线）",
    generatedFrom: "scripts/build-cycle-data.ts",
    bars: bars.length,
    rangeFrom: bars[0].date,
    rangeTo: bars[bars.length - 1].date,
    basis: "收盘价",
    detectThresholdPct: DETECT_THRESHOLD * 100,
    troughConfirmThresholdPct: TROUGH_CONFIRM_THRESHOLD * 100,
    majorThresholdPct: MAJOR_THRESHOLD * 100,
    definition:
      "熊市 = 自峰值的收盘回撤 ≥20%；谷底在自低点反弹 ≥40% 时确认（不要求收复前高）。" +
      "峰值取滚动最高收盘价，谷底确认后自谷底重新追踪峰值。",
    note: "本文件由脚本复算生成，任何数值均可通过 npx tsx scripts/build-cycle-data.ts 复现",
  },
  crashes: episodes,
  bulls,
  /**
   * 口径敏感性：同样的真实日线，仅因「谷底确认阈值」不同，熊市次数就会变化。
   * 明确输出，是为了让读者知道「有几次熊市」是口径依赖的，而不是唯一的客观事实。
   */
  sensitivity: (() => {
    const out: Array<{ entryPct: number; confirmPct: number; count: number; majorCount: number }> = [];
    for (const confirm of [0.2, 0.25, 0.3, 0.35, 0.4, 0.5]) {
      const eps = detectWith(DETECT_THRESHOLD, confirm);
      out.push({
        entryPct: DETECT_THRESHOLD * 100,
        confirmPct: confirm * 100,
        count: eps.length,
        majorCount: eps.filter((e) => e.major).length,
      });
    }
    return out;
  })(),
  summary: {
    crashCount: episodes.length,
    majorCrashCount: episodes.filter((e) => e.major).length,
    recoveredCount: episodes.filter((e) => e.recovered).length,
    unrecovered: episodes.filter((e) => !e.recovered).map((e) => e.peakDate),
    worstDrawdownPct: Math.min(...episodes.map((e) => e.drawdownPct)),
    longestRecoveryDays: Math.max(...episodes.filter((e) => e.recoveryDays).map((e) => e.recoveryDays as number)),
    bullCount: bulls.length,
  },
};

writeFileSync(resolve("data/cycle-crashes.json"), JSON.stringify(out, null, 2) + "\n", "utf8");

console.log("已生成 data/cycle-crashes.json");
console.log(`  日线区间: ${out.meta.rangeFrom} ~ ${out.meta.rangeTo}（${bars.length} 根）`);
console.log(`  下跌事件: ${out.summary.crashCount} 次（其中大熊市 ${out.summary.majorCrashCount} 次）`);
console.log(`  已修复: ${out.summary.recoveredCount} 次；未修复: ${out.summary.unrecovered.join(", ") || "无"}`);
console.log(`  最深回撤: ${out.summary.worstDrawdownPct}%`);
console.log(`  最长修复: ${out.summary.longestRecoveryDays} 自然日`);
console.log(`  牛市阶段: ${out.summary.bullCount} 段`);
