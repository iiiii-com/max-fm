/** 产业地图四轴页面检查（全程 node，避免 PowerShell 编码问题） */
const BASE = process.argv[2] || "http://localhost:3110";

const CASES = [
  { name: "全景图", url: "/industry", keys: ["产业地图", "产业链分层", "从结构接到当下", "板块行情与资金", "政策解读", "宏观仪表盘"] },
  { name: "关系网络", url: "/industry?tab=network", keys: ["跨链关系矩阵", "双向关联", "单向关联", "枢纽链", "双向强关联", "力导向关系图", "38 × 38"] },
  { name: "按景气", url: "/industry?tab=prosperity", keys: ["按景气状态分组", "高景气", "中景气", "分化", "低景气", "段环节"] },
  // 「扩展产业链」只在静态图谱存在 DB 未收录的链时才渲染；现在两边已对齐，故不断言它
  { name: "产业链列表", url: "/industry?tab=chains", keys: ["主线产业链"] },
];

let bad = 0;
for (const c of CASES) {
  const res = await fetch(BASE + c.url);
  const html = await res.text();
  const miss = c.keys.filter((k) => !html.includes(k));
  const ok = res.ok && miss.length === 0;
  if (!ok) bad++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${c.name.padEnd(10)} HTTP ${res.status}  bytes=${html.length}  缺失=${miss.length ? miss.join(" / ") : "无"}`);
}

// 注：ECharts 是客户端渲染，纯 fetch 拿到的 HTML 里不会有 canvas。
// 图表是否真的画出来要用浏览器验证（见 scripts/verify-industry-charts.mjs）。

console.log(bad === 0 ? "\nINDUSTRY-E2E: 全部通过" : `\nINDUSTRY-E2E: ${bad} 项失败`);
process.exit(bad === 0 ? 0 : 1);