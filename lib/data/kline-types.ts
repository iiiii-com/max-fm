/**
 * K 线的基础类型定义。
 *
 * 放在 lib/ 而不是路由文件里，是为了让纯计算模块（kline-finalize / indicators）
 * 不必反向 import app/api 下的路由文件——那会把 next/server、数据库连接一起拖进单测。
 * app/api/stock/kline/route.ts 继续 re-export 这两个类型，外部调用点无需改动。
 */

export interface KlineBar {
  /** 交易日/周期末日期（yyyy-mm-dd） */
  date: string;
  open: number;
  close: number;
  high: number;
  low: number;
  /** 成交量，单位统一为「手」 */
  volume: number;
  /** 成交额，单位元 */
  amount: number;
}

export type KlinePeriod = "day" | "week" | "month";
