/**
 * CSV 导出工具：转义、公式注入防护、RFC 5987 文件名。
 *
 * 为什么单独成文件并配断言：这三段都是"看起来显然、错了却不报错"的逻辑 ——
 *  1) 公式注入：单元格以 = + - @ 开头时 Excel/Sheets 会当公式执行。标的名或备注里
 *     出现这类字符就会变成注入（CSV Injection），不是理论问题。
 *  2) 中文文件名：HTTP 头只能承载 Latin-1，直接写中文会抛
 *     `Cannot convert argument to a ByteString`（"行" 码位 34892 > 255），
 *     整个导出 500 —— 这个 bug 真发生过，所以固定下来。
 *  3) RFC 5987：encodeURIComponent 不转义 ( ) ' *，但这几个在 RFC 5987 里必须转义。
 */

/** RFC4180 转义 + 公式注入防护 */
export function cell(v: unknown): string {
  const s = v == null ? "" : String(v);
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/**
 * 组装 CSV。前几行是元信息注释（# 开头），下面是表头与数据。
 * 加 BOM：否则 Excel 打开中文会乱码。
 */
export function toCsv(meta: string[], header: string[], rows: unknown[][]): string {
  const lines = [
    ...meta.map((m) => `# ${m}`),
    header.map(cell).join(","),
    ...rows.map((r) => r.map(cell).join(",")),
  ];
  return "\uFEFF" + lines.join("\r\n") + "\r\n";
}

/**
 * Content-Disposition 头值。
 * asciiName 给老客户端，utf8Name 走 RFC 5987 的 filename*（现代客户端优先用它）。
 */
export function contentDisposition(asciiName: string, utf8Name: string): string {
  const encoded = encodeURIComponent(utf8Name).replace(
    /[!'()*]/g,
    (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase()
  );
  return `attachment; filename="${asciiName}"; filename*=UTF-8''${encoded}`;
}

/** 头值必须是 Latin-1 可编码的；用于在写响应前自证不变量 */
export function isHeaderSafe(value: string): boolean {
  return /^[\x20-\x7E]*$/.test(value);
}

export const csvStamp = () => new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");