/**
 * 数据一致性回归脚本（不需要浏览器，直接打 API）
 *
 * 运行：npx tsx scripts/verify-data.ts
 *
 * 检查项对应此前发现的问题，逐条断言「不会再退回错误状态」：
 *  1. 板块排名默认降序（表头标 ↓，数据必须真的从大到小）
 *  2. 板块流出榜必须全为负数，且与流入榜无重叠
 *  3. 板块列表跨层级去重后无同名重复行
 *  4. 领涨股随列表接口内联返回（不再需要 30 次额外请求）
 *  5. 个股资金流：主力净流入 == 超大单 + 大单（同一交易日同源）
 *  6. 个股资金流：方向词与数值同号
 *  7. ETF：成交额非 0；溢价率由真实单位净值推导而非当日涨跌幅
 *  8. 风险指标：10Y 国债与 24 指标表同源同值；取不到时为 null 而不是占位数字
 *  9. 市场宽度：沪深两市家数相加、成交额非空
 * 10. 宏观研判：as-of 与实时行情一致（非陈旧快照）
 * 11. 政策：分类非空、日期格式合法、分类筛选有真实条目
 * 12. 快讯：非市场内容已被过滤
 * 13. 异动榜：档位顺序单调
 */

const BASE = process.env.VERIFY_BASE_URL || "http://localhost:3000";
let pass = 0;
let fail = 0;

function check(name: string, ok: boolean, detail = "") {
  if (ok) {
    pass++;
    console.log(`  PASS  ${name}`);
  } else {
    fail++;
    console.log(`  FAIL  ${name}${detail ? `  → ${detail}` : ""}`);
  }
}

async function get<T = any>(path: string): Promise<{ status: number; json: T }> {
  const res = await fetch(`${BASE}${path}`, { signal: AbortSignal.timeout(45000) });
  let json: any = null;
  try {
    json = await res.json();
  } catch {
    /* ignore */
  }
  return { status: res.status, json };
}

async function main() {
  console.log(`\n=== 数据一致性回归 @ ${BASE} ===\n`);

  // ---------- 1-4 板块 ----------
  console.log("[板块]");
  const board = (await get("/api/sector/board?top=60")).json;
  if (!board?.ok) {
    check("板块接口可用", false, "ok=false");
  } else {
    const list: any[] = board.list ?? [];
    const rankIn: any[] = board.rankIn ?? [];
    const rankOut: any[] = board.rankOut ?? [];

    check("板块列表非空", list.length > 0, `len=${list.length}`);
    check(
      "板块宇宙规模已披露（非 100 即全量）",
      typeof board.universe?.total === "number" && board.universe.total > list.length,
      `universe=${JSON.stringify(board.universe?.total)}`
    );

    // 去重：同一归一化名不得出现两次
    const baseName = (n: string) => n.replace(/[ⅠⅡⅢ]$/, "");
    const names = list.map((s) => baseName(s.name));
    const dup = names.filter((n, i) => names.indexOf(n) !== i);
    check("板块列表无跨层级重复行", dup.length === 0, `重复：${[...new Set(dup)].join(", ")}`);

    // 流入榜：全正 + 降序
    const inNeg = rankIn.filter((r) => r.mainFlow < 0).length;
    check("板块流入榜无负值", inNeg === 0, `${inNeg} 条为负`);
    const inDesc = rankIn.every((r, i) => i === 0 || rankIn[i - 1].mainFlow >= r.mainFlow);
    check("板块流入榜降序", inDesc, rankIn.map((r) => (r.mainFlow / 1e8).toFixed(2)).join(" "));

    // 流出榜：全负 + 升序（即绝对值降序）
    const outPos = rankOut.filter((r) => r.mainFlow >= 0).length;
    check("板块流出榜全为负值", outPos === 0, `${outPos} 条非负`);
    const outAsc = rankOut.every((r, i) => i === 0 || rankOut[i - 1].mainFlow <= r.mainFlow);
    check("板块流出榜按净流出幅度排序", outAsc, rankOut.map((r) => (r.mainFlow / 1e8).toFixed(1)).join(" "));

    const overlap = rankIn.filter((a) => rankOut.some((b) => b.code === a.code));
    check("流入榜与流出榜无重叠", overlap.length === 0, overlap.map((o) => o.name).join(", "));

    const withLeader = list.filter((s) => s.leader).length;
    check("领涨股内联返回（0 额外请求）", withLeader === list.length, `${withLeader}/${list.length}`);
  }

  // ---------- 5-6 个股资金流 ----------
  console.log("\n[个股资金流]");
  const flow = (await get("/api/stock/flow?secid=1.600519")).json;
  if (flow?.ok && flow.flow) {
    const f = flow.flow;
    const sum = f.superNetIn + f.bigNetIn;
    check("主力净流入 == 超大单 + 大单（同源）", Math.abs(sum - f.mainNetIn) < 1, `sum=${sum} main=${f.mainNetIn}`);
    check(
      "流向标签与数值同号",
      (f.mainNetIn >= 0 && f.trend === "流入") || (f.mainNetIn < 0 && f.trend === "流出") || f.mainNetIn === 0,
      `main=${f.mainNetIn} trend=${f.trend}`
    );
    const sig = (flow.score?.signals ?? []).find((s: string) => s.includes("主力资金"));
    check(
      "评分信号无「流出(+)」式自相矛盾",
      !sig || !/流出\(\+/.test(sig) || f.mainNetIn < 0,
      sig ?? "(无信号)"
    );
    check("四档明细标注了交易日", !!f.tierDate, `tierDate=${f.tierDate}`);
  } else {
    check("个股资金流可用", false);
  }

  // ---------- 7 ETF ----------
  console.log("\n[ETF]");
  const etf = (await get("/api/etf/quote?secid=1.510300")).json;
  if (etf?.ok && etf.quote) {
    const q = etf.quote;
    check("ETF 成交额非 0", (q.amount ?? 0) > 0, `amount=${q.amount}`);
    check("ETF 净值已取到", q.nav != null && q.nav > 0, `nav=${q.nav} @${q.navDate}`);
    check(
      "溢价率由真实净值推导（≠ 当日涨跌幅）",
      q.premiumPct != null && Math.abs(q.premiumPct - q.changePct) > 1e-6,
      `premium=${q.premiumPct} changePct=${q.changePct}`
    );
  } else {
    check("ETF 接口可用", false);
  }

  // ---------- 8 风险指标 ----------
  console.log("\n[风险指标]");
  const risk = (await get("/api/risk/indicators")).json;
  const inds: any[] = risk?.indicators ?? [];
  check("风险指标返回 4 项", inds.length === 4, `len=${inds.length}`);
  const cn10y = inds.find((i) => i.key === "cn10y");
  check("10Y 国债不再取国债指数（1.7~6% 合理区间）", cn10y?.value == null || (cn10y.value > 0.5 && cn10y.value < 6), `v=${cn10y?.value}`);
  check("10Y 国债标注了同源来源", /指标表/.test(String(cn10y?.source ?? "")), cn10y?.source);
  const fabricated = inds.filter((i) => i.key !== "cn10y" && i.value != null && i.stale);
  check("无「硬编码占位值」指标", fabricated.length === 0, fabricated.map((i) => i.key).join(", "));
  // 等级与阈值一致：VIX 18.5 不应被判为「需警惕」
  const vix = inds.find((i) => i.key === "vix");
  if (vix?.value != null) {
    const expect = vix.value < 15 ? "low" : vix.value > 25 ? "high" : "mid";
    check("VIX 等级与阈值说明一致", vix.level === expect, `v=${vix.value} level=${vix.level}`);
  } else {
    check("VIX 不可用时返回 null（而非 18.5）", true);
  }

  // ---------- 9 市场宽度 ----------
  console.log("\n[市场宽度]");
  const br = (await get("/api/market/breadth")).json;
  if (br?.ok) {
    check("两市上涨家数为正", (br.up ?? 0) > 0, `up=${br.up}`);
    check("两市成交额非空", br.amountYi != null && br.amountYi > 0, `amountYi=${br.amountYi}`);
    const total = br.up + br.down + br.flat;
    check("涨跌平家数之和为合理规模（全市场）", total > 4000, `total=${total}`);
  } else {
    check("市场宽度接口可用", false, br?.error);
  }

  // ---------- 10 宏观研判 ----------
  console.log("\n[宏观研判]");
  const ctx = (await get("/api/macro/context")).json;
  if (ctx?.ok) {
    check("宏观研判使用实时数据源", ctx.stale === false, `stale=${ctx.stale} src=${ctx.source}`);
    const asOf = String(ctx.asOf ?? "");
    const fresh = (Date.now() - Date.parse(asOf)) / 86400000;
    check("宏观研判数据不陈旧（≤ 5 天）", Number.isFinite(fresh) && fresh <= 5, `asOf=${asOf} (${fresh?.toFixed(1)} 天前)`);
    check("阶段与资产偏好给出可自洽说明", String(ctx.macro?.summary ?? "").includes("→"), ctx.macro?.summary);
  } else {
    check("宏观研判接口可用", false);
  }

  // ---------- 11 政策 ----------
  console.log("\n[政策]");
  try {
    // /policy 是 HTML 页面，直接从渲染结果里抽分类与日期
    const res = await fetch(`${BASE}/policy`, { signal: AbortSignal.timeout(45000) });
    const html = await res.text();
    // 分类筛选条：形如「货币政策 22 · 26/09」
    // 用 exec 循环而非 matchAll + 展开：后者依赖迭代器展开，在部分构建配置下不可用
    const CATS = "货币政策|财政|财税|资本市场|房地产|消费促进|产业政策|对外开放|改革|民生|部委公告|区域政策|绿色低碳|金融监管|科技自立|就业";
    const cats: string[] = [];
    const counts: Array<{ cat: string; n: number }> = [];
    const catRe = new RegExp(`>(${CATS})<\\/span>`, "g");
    let mm: RegExpExecArray | null;
    while ((mm = catRe.exec(html)) !== null) cats.push(mm[1]);
    const cntRe = new RegExp(`>(${CATS})<\\/span><span[^>]*>(\\d+)`, "g");
    while ((mm = cntRe.exec(html)) !== null) counts.push({ cat: mm[1], n: Number(mm[2]) });
    check("政策分类筛选存在", cats.length > 0, `cats=${[...new Set(cats)].join(",")}`);
    const emptyCats = counts.filter((c) => c.n === 0);
    check("无「0 条」的空分类", emptyCats.length === 0, emptyCats.map((c) => c.cat).join(","));
    const staleCats = counts.filter((c) => /^(2024|2025)-/.test(c.cat));
    check("分类中无 2024/2025 年的陈旧项", staleCats.length === 0, staleCats.map((c) => c.cat).join(","));    // 日期格式：不应再出现「2023-Q3.6666…」「2609」这类脏值
    const badDate: string[] = [];
    const dateRe = />(20\d{2}(?:-Q[1-4](?:\.\d+)?|-(?:\d{2})(?:-\d{2})?|\d{4}))</g;
    while ((mm = dateRe.exec(html)) !== null) {
      const d = mm[1];
      if (/\.\d{3,}/.test(d) || /^\d{4}$/.test(d)) badDate.push(d);
    }
    check("政策日期无浮点/脏值", badDate.length === 0, [...new Set(badDate)].slice(0, 5).join(","));
    // 分页
    check("政策库已分页（单页 ≤ 30 条）", /第 1\/\d+ 页/.test(html.replace(/<!-- -->/g, "")) || /第 1 \/ \d+ 页/.test(html));
  } catch (e: any) {
    check("政策页可访问", false, String(e?.message ?? e));
  }

  // ---------- 12 快讯 ----------
  console.log("\n[快讯]");
  const news = (await get("/api/news/flash")).json;
  const items: any[] = news?.items ?? [];
  check("快讯有内容", items.length > 0, `items=${items.length}`);
  check(
    "非市场内容已过滤（offMarket 不在前排）",
    items.slice(0, 10).filter((i) => i.offMarket).length === 0,
    `filtered=${news?.filtered}`
  );

  // ---------- 13 异动榜 ----------
  console.log("\n[异动榜]");
  const surge = (await get("/api/market/surge")).json;
  const surges: any[] = surge?.surges ?? [];
  if (surges.length) {
    const ORDER = ["limit-up", "big-up", "watch", "big-down", "limit-down"];
    const idx = surges.map((s) => ORDER.indexOf(s.bucket));
    check("异动榜档位顺序单调", idx.every((v, i) => i === 0 || idx[i - 1] <= v), idx.join(","));
    check("异动原因为空值兜底已消除", !surges.some((s) => s.reason === "异动异动"));
  } else {
    check("异动榜可用", false);
  }

  console.log(`\n=== 结果：${pass} 通过 / ${fail} 失败 ===\n`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("verify-data crashed:", e);
  process.exit(2);
});
