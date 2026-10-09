/**
 * CSV 导出工具自检：公式注入防护、RFC4180 转义、中文文件名的头安全。
 * 运行：node scripts/verify-csv.mjs
 */
import assert from "node:assert/strict";
import { cell, toCsv, contentDisposition, isHeaderSafe } from "../lib/data/csv.ts";

// 公式注入：= + - @ 开头必须前置单引号，否则 Excel/Sheets 会当公式执行
{
  assert.equal(cell("=1+1"), "'=1+1");
  assert.equal(cell("+cmd|'/c calc'!A1"), "'+cmd|'/c calc'!A1");
  assert.equal(cell("-2+3"), "'-2+3");
  assert.equal(cell("@SUM(A1)"), "'@SUM(A1)");
  // 制表符/回车开头同样有注入风险（会被当分隔符拆开）→ 加防注入前缀
  // tab 不是 CSV 分隔符，无需再包引号；回车会破坏行结构，需包引号
  assert.equal(cell("\t=1+1"), "'\t=1+1");
  assert.equal(cell("\r=1+1"), '"\'\r=1+1"');
  // 正常文本不得被改动
  assert.equal(cell("银行"), "银行");
  assert.equal(cell("BK0475"), "BK0475");
  assert.equal(cell(12.5), "12.5");
  assert.equal(cell(null), "");
  assert.equal(cell(undefined), "");
}

// RFC4180 转义：逗号、引号、换行必须包引号，内部引号翻倍
{
  assert.equal(cell('say "hi"'), '"say ""hi"""');
  assert.equal(cell("a,b"), '"a,b"');
  assert.equal(cell("line1\nline2"), '"line1\nline2"');
}

// 组装：BOM + # 元信息 + 表头 + 数据，CRLF 分隔
{
  const csv = toCsv(["窗口 2023-01-01 ~ 2026-01-01"], ["名称", "分值"], [["银行", 99]]);
  assert.ok(csv.startsWith("\uFEFF"), "必须带 BOM，否则 Excel 中文乱码");
  assert.ok(csv.includes("# 窗口 2023-01-01 ~ 2026-01-01"));
  assert.ok(csv.includes("名称,分值"));
  assert.ok(csv.includes("银行,99"));
  assert.ok(csv.includes("\r\n"), "必须用 CRLF");
}

// 中文文件名：Content-Disposition 必须仍然只含 Latin-1（否则 HTTP 头会抛错 → 导出 500）
{
  const d = contentDisposition("sector-rank-2026.csv", "行业景气排行-2026.csv");
  assert.ok(isHeaderSafe(d), "头值含非 Latin-1 字符会让响应直接 500");
  assert.ok(d.includes('filename="sector-rank-2026.csv"'), "必须给老客户端 ASCII 回退名");
  assert.ok(d.includes("filename*=UTF-8''"), "必须走 RFC 5987");
  // RFC 5987 要求转义 ( ) ' * —— encodeURIComponent 不转义这几个，需手动补
  const d2 = contentDisposition("a.csv", "a(b)'c*d.csv");
  assert.ok(isHeaderSafe(d2));
  assert.ok(!/[()'*]/.test(d2.split("UTF-8''")[1]), "RFC 5987 的值里不得残留 ( ) ' *");
}

// 头安全检查本身：ASCII 通过，中文/控制字符拒绝
{
  assert.equal(isHeaderSafe('attachment; filename="a.csv"'), true);
  assert.equal(isHeaderSafe("行业"), false);
  assert.equal(isHeaderSafe("a\u0000b"), false);
}

console.log("csv: 5 组断言全过");