import { Clock, Database } from "lucide-react";

/** 统一数据来源 · 更新时间 · 口径注脚（全站数据可信基建） */
export default function DataNote({
  source,
  updated,
  note,
  className = "",
}: {
  /** 数据来源描述，如 "东方财富实时行情" */
  source: string;
  /** 更新时间（ISO 字符串），可选 */
  updated?: string | null;
  /** 口径说明，可选 */
  note?: string;
  className?: string;
}) {
  return (
    <p className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted ${className}`}>
      <span className="inline-flex items-center gap-1">
        <Database className="w-3 h-3" /> 数据源：{source}
      </span>
      {updated ? (
        <span className="inline-flex items-center gap-1">
          <Clock className="w-3 h-3" /> 更新：
          {new Date(updated).toLocaleString("zh-CN", { hour12: false })}
        </span>
      ) : null}
      {note ? <span className="opacity-80">{note}</span> : null}
    </p>
  );
}
