/**
 * 来源声明：本文件危机历史数据基于公开史料与权威历史记录整理（如美联储历史数据、
 * 道琼斯/标普历史行情、公开学术与史料文献），数值可能存在历史口径差异；
 * 阶段 K 线由行情接口实时绘制。核验日期：2026-08-25。
 */
import { Crisis } from "./types";
import { subprime2008 } from "./2008-subprime";
import { ashare2015 } from "./2015-ashare-crash";
import { covid2020 } from "./2020-covid-crash";
import { depression1929 } from "./1929-great-depression";
import { asian1997 } from "./1997-asian-crisis";
import { dotcom2000 } from "./2000-dotcom-bubble";
import { lesserCrises } from "./lesser";

export const CRISES: Crisis[] = [
  subprime2008,
  ashare2015,
  covid2020,
  depression1929,
  asian1997,
  dotcom2000,
  ...lesserCrises,
];

export function getCrisis(id: string): Crisis | undefined {
  return CRISES.find((c) => c.id === id);
}