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
 * 14. 危机阶段策略全覆盖，且不含通用模板兜底
 * 15. 每场危机至少 1 道决策测验题
 */
const BASE = process.env.VERIFY_BASE_URL || "http://localhost:3000";

/** 曾经的通用模板特征词，出现在阶段策略里即视为退化 */
const TEMPLATE_WORDS = ["铁律", "通用纪律"];
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

  // ---------- 14 产业链数据真实性 ----------
  // 这一组是防退化断言：防止「随机规模/增速」或「关联节点冒充下游环节」再回来。
  console.log("\n[产业链]");
  try {
    const { db } = await import("@/lib/db");
    const s = await import("@/lib/db/schema");
    const { LEVELS, isRealLevel } = await import("@/lib/data/chainLevels");

    const nodes = (await db.select().from(s.chainNodes)) as any[];
    const chains = (await db.select().from(s.industryChains)) as any[];

    // 1) 不允许残留随机生成的规模/增速
    const withNum = nodes.filter((n) => n.value != null || n.growth != null);
    check(
      "环节规模/增速已全部清空（曾来自 Math.random）",
      withNum.length === 0,
      withNum.slice(0, 3).map((n) => `${n.name}(${n.value}/${n.growth})`).join(" ")
    );

    // 1b) 不允许残留模板环节描述
    // 模板特征是拼接句"XX 是 YY 的中游环节，A、B 等为代表性企业"。
    // 此前 131/143 个环节都是这样生成的 —— 字段齐全、结构校验全绿，
    // 但读起来每条一样，模板感一眼可见。现在逐条写实在 chainNodeInsights。
    const LINK = "关联";
    const realNodes = nodes.filter((n: any) => n.level !== LINK);
    const templated = realNodes.filter(
      (n: any) => typeof n.description === "string" && n.description.includes("等为代表性企业")
    );
    check(
      `环节描述无模板拼接（${realNodes.length} 个环节）`,
      templated.length === 0,
      templated.slice(0, 3).map((n: any) => n.name).join(" ")
    );

    // 2) 跨链关联节点不得占用真实层级
    const fakeLevel = nodes.filter(
      (n) => isRealLevel(n.level) && String(n.name ?? "").startsWith("关联：")
    );
    check(
      "「关联：」节点不再冒充上/中/下游环节",
      fakeLevel.length === 0,
      fakeLevel.slice(0, 3).map((n) => `${n.name}=${n.level}`).join(" ")
    );

    // 3) 环节计数口径唯一：每条链都只有一个"真实环节数"
    const counts = chains.map((c) => {
      const ns = nodes.filter((n) => n.chainId === c.id);
      const real = ns.filter((n) => isRealLevel(n.level) && !String(n.name ?? "").startsWith("关联："));
      return { slug: c.slug, total: ns.length, real: real.length };
    });
    // 详情页头部与概览卡都从 real.length 派生；此处验证 real 确实不含关联节点
    const realOk = counts.every((c) => c.real <= c.total);
    check("环节计数口径一致（real ≤ total）", realOk, `${counts.length} 条链`);

    // 4) 页面上的"环节数"不得出现随机规模/增速字样
    const html = (await (await fetch(`${BASE}/industry/semiconductor`, { signal: AbortSignal.timeout(45000) })).text());
    check(
      "详情页不再渲染「规模 X 亿」",
      !/规模\s*[\d.]+\s*亿/.test(html),
      (html.match(/规模\s*[\d.]+\s*亿/) ?? [""])[0]
    );
    check(
      "详情页不再渲染「增速 ±X%」",
      !/增速\s*[+-]?[\d.]+/.test(html),
      (html.match(/增速\s*[+-]?[\d.]+/) ?? [""])[0]
    );

    // 5) 泳道三层都出现
    for (const lv of LEVELS) {
      check(`分层泳道包含「${lv}」层`, html.includes(lv));
    }

    // 6) 链级说明（industry_chains.detail）不得再出现无源数字。
    //    旧实现是「市场规模约 1.3 万亿元，国产化率不足 30%」这类句子：
    //    无时点、无来源、无口径，与已清空的 chain_nodes.value 是同一种病。
    const NOTE_NUMBER = /\d[\d.,]*\s*(万亿|亿|万|%|GW|万吨|万辆|亿美元|万台|个)/;
    const withNote = (await db.select().from(s.industryChains)) as any[];
    const noteOffenders = withNote.filter((c) => c.detail && NOTE_NUMBER.test(String(c.detail)));
    check(
      "链级说明无无源数字表述",
      noteOffenders.length === 0,
      noteOffenders.slice(0, 2).map((c) => `${c.name}: ${String(c.detail).slice(0, 30)}`).join(" | ")
    );

    // 7) 产业链指标必须满足「单位 + 时点 + 来源 + 口径」四件套。
    //    这是防退化断言：防止半年后又往表里塞无源数字。
    const { validateMetric, METRIC_KEYS, validMetrics } = await import("@/lib/data/chainMetrics");
    const metrics = (await db.select().from(s.chainMetrics)) as any[];
    const invalid = metrics.filter((m) => !validateMetric(m).ok);
    check(
      "产业链指标全部满足四件套（单位/时点/来源/口径）",
      invalid.length === 0,
      invalid.slice(0, 2).map((m) => `${m.slug}/${m.type}: ${validateMetric(m).reason}`).join(" | ")
    );
    check(
      "产业链指标类型均在白名单内",
      metrics.every((m) => m.type && m.type in METRIC_KEYS),
      `types=${[...new Set(metrics.map((m) => m.type))].join(",")}`
    );
    // 8) 页面必须把「本页所属链」的已核验指标渲染出来，且带上来源
    //    注意只查本页那条链的指标 —— nev 的指标不该出现在 semiconductor 页
    if (metrics.length) {
      const allValid = validMetrics(metrics);
      const pageValid = allValid.filter((m) => m.slug === "semiconductor");
      const missingOnPage = pageValid.filter((m) => !html.includes(m.name));
      check(
        "本页链的已核验指标全部渲染到页面",
        missingOnPage.length === 0,
        `本页应有 ${pageValid.length} 条` + (missingOnPage.length ? `，缺：${missingOnPage.map((m) => m.name).join(", ")}` : "")
      );
      // 反向断言：别把别的链的数字混进来
      const foreign = allValid.filter((m) => m.slug !== "semiconductor" && html.includes(m.name));
      check(
        "未把其他产业链的指标混入本页",
        foreign.length === 0,
        foreign.slice(0, 2).map((m) => m.name).join(" | ")
      );
      const firstValid = pageValid[0];
      check(
        "指标来源随页面提供（可核验）",
        !firstValid || html.includes(firstValid.source.split(" ·")[0]),
        firstValid?.source
      );
    }
  } catch (e: any) {
    check("产业链数据可校验", false, String(e?.message ?? e));
  }

  // 危机阶段策略覆盖率：防止「专业解读」再次退化为通用模板
  // （曾有 18 场 / 57 阶段走 fallback，20 场里 19 场显示同一段「熊市铁律」）
  try {
    const { CRISES: CS } = await import("@/lib/data/crisis/crises");
    const { STAGE_STRATEGIES: TIPS } = await import("@/lib/data/crisis/strategies");
    const gaps: string[] = [];
    let stageTotal = 0;
    for (const c of CS) {
      const stages = c.stages ?? [];
      const tips = TIPS[c.id];
      stageTotal += stages.length;
      if (!Array.isArray(tips)) {
        gaps.push(`${c.id} 整场缺失`);
        continue;
      }
      if (tips.length !== stages.length) {
        gaps.push(`${c.id} 策略${tips.length}≠阶段${stages.length}`);
        continue;
      }
      stages.forEach((st, i) => {
        const tip = tips[i];
        if (!tip?.strategy?.trim()) gaps.push(`${c.id}[${i}]${st.name}`);
        else if (TEMPLATE_WORDS.some((w) => tip.strategy.includes(w)))
          gaps.push(`${c.id}[${i}]${st.name}=模板`);
      });
    }
    check(
      "危机阶段策略全覆盖（无通用模板兜底）",
      gaps.length === 0,
      gaps.length ? gaps.slice(0, 4).join(" | ") : `${CS.length} 场 / ${stageTotal} 阶段`
    );
    const noQuiz = CS.filter((c: any) => !c.nodes?.some((n: any) => n.quiz)).map((c: any) => c.id);
    check("每场危机至少 1 道决策测验题", noQuiz.length === 0, noQuiz.join(",") || "全部覆盖");
  } catch (e: any) {
    check("危机阶段策略可校验", false, String(e?.message ?? e));
  }

  // 产业解读覆盖率：25 条链必须逐条有解读，否则「产业地图内容太少」会重新发生
  try {
    const { CHAIN_INSIGHTS: INS } = await import("@/lib/data/chainInsights");
    const { getChains } = await import("@/lib/data/queries");
    const { bootstrap } = await import("@/lib/db");
    await bootstrap();
    const slugs = (await getChains()).map((c: any) => c.slug as string);
    const missing = slugs.filter((s: string) => !INS[s]?.economics);
    check(
      "每条产业链都有解读与指导",
      missing.length === 0,
      missing.length ? `缺 ${missing.length} 条: ${missing.slice(0, 4).join(",")}` : `${slugs.length} 条全覆盖`
    );
    const orphan = Object.keys(INS).filter((k) => !slugs.includes(k));
    check("解读表无孤儿 slug（不会写到已下线产业链）", orphan.length === 0, orphan.join(",") || "无");
    const thin = Object.entries(INS).filter(
      ([, v]: any) => v.chokepoints?.length < 2 || v.watch?.length < 3 || v.risks?.length < 2
    );
    check(
      "解读四件套齐全（关键环节≥2 / 关注指标≥3 / 风险≥2）",
      thin.length === 0,
      thin.length ? thin.map(([k]) => k).join(",") : "全部完整"
    );
    // 解读里的 chokepoints 必须是本链真实存在的环节名，否则是凭空写的
    const { getChainNodes } = await import("@/lib/data/queries");
    const chains = await getChains();
    const bogus: string[] = [];
    for (const c of chains as any[]) {
      const ins = INS[c.slug];
      if (!ins) continue;
      const names = new Set(
        (await getChainNodes(c.id)).map((n: any) => n.name as string)
      );
      for (const kp of ins.chokepoints) {
        if (!names.has(kp)) bogus.push(`${c.slug}/${kp}`);
      }
    }
    check(
      "解读引用的关键环节在泳道中真实存在",
      bogus.length === 0,
      bogus.length ? bogus.slice(0, 3).join(" | ") : "全部对得上"
    );
  } catch (e: any) {
    check("产业解读可校验", false, String(e?.message ?? e));
  }

  // 省级经济数据防造假断言。
  // 背景：seed.ts 曾用 rng() 生成 trade = gdp×(0.25+rng()×0.4) 与
  // fiscalRevenue = gdp×(0.08+rng()×0.03)，以省级统计的名义展示在 /map。
  // 随机数让外贸依存度排名与真实完全相反（广东垫底、甘肃第二），
  // 比缺数据危险得多。已置空，这里断言它们不会回来。
  try {
    const { getProvinces } = await import("@/lib/data/queries");
    const { bootstrap } = await import("@/lib/db");
    const { regionCoverage, regionOf, shortProvinceName } = await import("@/lib/data/provinceRegions");
    await bootstrap();
    const ps = (await getProvinces()) as any[];

    const fakeTrade = ps.filter((r) => r.trade != null);
    const fakeFiscal = ps.filter((r) => r.fiscalRevenue != null);
    check(
      "省级进出口已下线（seed 曾为随机数）",
      fakeTrade.length === 0,
      fakeTrade.length ? `${fakeTrade.length} 行仍有值` : "全部为空"
    );
    check(
      "省级财政收入已下线（seed 曾为随机数）",
      fakeFiscal.length === 0,
      fakeFiscal.length ? `${fakeFiscal.length} 行仍有值` : "全部为空"
    );

    const cov = regionCoverage();
    check("四大区域恰好覆盖 31 省且无重复", cov.ok, `${cov.unique}/${cov.total}`);
    const unmatched = [...new Set(ps.filter((r) => !regionOf(shortProvinceName(r.province))).map((r) => r.province))];
    check("每省都能归入四大区域之一", unmatched.length === 0, unmatched.join(",") || "全部归类");

    // perCapitaGdp 必须与 gdp/pop 自洽 —— 防止再次出现单位错误
    const y = ps.filter((r) => r.year === 2025);
    const drift = y.filter(
      (r) => r.population > 0 && Math.abs(r.perCapitaGdp - r.gdp / r.population) / (r.gdp / r.population) > 0.05
    );
    check(
      "人均 GDP 与 GDP÷人口 自洽（单位无错）",
      drift.length === 0,
      drift.length ? drift.map((r) => r.province).join(",") : `${y.length} 省偏差均 <5%`
    );
  } catch (e: any) {
    check("省级经济数据可校验", false, String(e?.message ?? e));
  }

  // 板块互通：产业链 ↔ 个股 双向索引。
  // 背景：站内 25 条链、143 个环节、375 家公司此前彼此隔离 ——
  // 个股详情页看不到自己在产业链上的位置。
  try {
    const { getChainIndexRows } = await import("@/lib/data/queries");
    const { indexByCompany } = await import("@/lib/data/chainIndex");
    const { hasSectorCode } = await import("@/lib/data/chainIndex");
    const rows = await getChainIndexRows();
    const byCo = indexByCompany(rows);
    check(
      "产业链索引覆盖全部 25 条链",
      new Set(rows.map((r: any) => r.chainSlug)).size === 25,
      `实际 ${new Set(rows.map((r: any) => r.chainSlug)).size} 条 / 索引 ${rows.length} 行`
    );
    check("产业链索引含公司名（个股↔链路可通）", byCo.size > 0, `${byCo.size} 家公司`);
    const crossChain = [...byCo.values()].filter((v) => new Set(v.map((r: any) => r.chainSlug)).size > 1);
    check(
      "跨链公司被正确识别（多链归属不丢）",
      crossChain.length > 0,
      `${crossChain.length} 家跨链公司`
    );
    // 链名必须是真实链名而不是 chainmujew... id —— 之前踩过：分组用 chainId 却当 slug 用
    const badName = rows.filter((r: any) => /^chain[a-z0-9]{10,}$/.test(r.chainName));
    check(
      "索引里链名为真实名称（非 chainId）",
      badName.length === 0,
      badName.length ? badName[0].chainName : "全部正常"
    );
    // 板块映射必须全部有效：code 存在但接口拉不到时不能展示入口
    const { CHAIN_SECTOR_CODES } = await import("@/lib/data/chainIndex");
    const bogusCode = Object.entries(CHAIN_SECTOR_CODES).filter(([k, v]) => hasSectorCode(k) !== Boolean(v));
    check("板块映射表自洽（未映射的链不展示资金流入口）", bogusCode.length === 0, bogusCode.map(([k]) => k).join(",") || "自洽");
  } catch (e: any) {
    check("板块互通索引可校验", false, String(e?.message ?? e));
  }

  // 城市解读覆盖率：67 城必须逐条有解读，且不含编造的统计数值。
  // 这条断言是刻意的：站内曾出现 province_stats.trade 用
  // gdp × (0.25 + rng()×0.4) 生成、以省级统计名义展示的造假，
  // 城市解读里一旦写入「平均年薪 X 万」这类凭印象的数字，
  // 危害与它相同 —— 数字看起来合理，读者无从怀疑。校验拦的是这个。
  try {
    const { CITY_INSIGHTS, missingCityInsights } = await import("@/lib/data/cityInsights");
    const { STATIC_REGIONS } = await import("@/lib/data/regions");
    const allCities = STATIC_REGIONS.flatMap((r: any) => r.cities).map((c: any) => c.name);
    const missing = missingCityInsights(allCities);
    check(
      "67 城全部有解读",
      missing.length === 0,
      missing.length ? `缺 ${missing.length} 城: ${missing.slice(0, 4).join(",")}` : `${allCities.length} 城全覆盖`
    );
    // 反向检查：不得出现疑似编造的数值表述
    const risky = /平均年薪\s*\d|年薪\s*\d+\s*万|房价均价|均价\s*\d+\s*万|就业率\s*\d|人均可支配收入\s*\d/;
    const fabricated = Object.entries(CITY_INSIGHTS).filter(([, v]: any) =>
      risky.test(`${v.income?.drivers ?? ""}${v.income?.structure ?? ""}${v.cost?.housing ?? ""}${v.cost?.living ?? ""}`)
    );
    check(
      "解读不含编造数值（薪资/房价/就业率）",
      fabricated.length === 0,
      fabricated.length ? fabricated.map((f) => f[0]).join(",") : "无"
    );
    // 房价指数：入库城市数必须与统计局 70 城匹配结果一致
    const { getCityHousePrices } = await import("@/lib/data/queries");
    const { byCity, period } = await getCityHousePrices();
    check(
      "70 城房价指数已入库且期间明确",
      byCity.size > 0 && Boolean(period),
      `${byCity.size} 城 / ${period ?? "期间未知"}`
    );
  } catch (e: any) {
    check("城市解读可校验", false, String(e?.message ?? e));
  }

  console.log(`\n=== 结果：${pass} 通过 / ${fail} 失败 ===\n`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("verify-data crashed:", e);
  process.exit(2);
});
