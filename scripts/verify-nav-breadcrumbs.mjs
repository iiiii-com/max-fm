/**
 * 导航与面包屑的**纯逻辑**自检（无浏览器、无依赖）。
 *
 * 与 scripts/verify-nav.mjs 的分工：
 *   verify-nav.mjs            —— 浏览器端验证导航的**渲染与交互**（下拉列数、悬停、
 *                                链接可达性），依赖 playwright-core。
 *   verify-nav-breadcrumbs.mjs —— 本文件，验证 nav.ts 的**数据与派生逻辑**：
 *                                结构完整性、面包屑层级、激活态判定。
 * 两者互补，不要合并：渲染要浏览器，逻辑不该被浏览器拖慢。
 *
 * 为什么要单独测：nav.ts 是站点导航的单一事实源（Header 下拉、面包屑、页脚站点地图共用），
 * 它一错就是全站性的 —— 改一个 href 可能让某页面包屑退回成「概览」，
 * 或者让下拉里出现一项点开是空的。这类错误不报错，只静静显示错的东西。
 * 运行：node scripts/verify-nav-breadcrumbs.mjs
 */
import assert from "node:assert/strict";
import { NAV, breadcrumbsFor, isGroupActive } from "../components/layout/nav.ts";

const labels = (pathname, params) => breadcrumbsFor(pathname, params).map((c) => c.label).join(" / ");

// 结构完整性
{
  const hrefs = NAV.map((g) => g.href);
  assert.equal(new Set(hrefs).size, hrefs.length, "板块 href 不得重复");

  for (const g of NAV) {
    assert.ok(g.href.startsWith("/"), `${g.href} 必须以 / 开头`);
    assert.ok(g.label && g.desc, `${g.href} 缺 label 或 desc`);
    assert.ok(g.icon, `${g.href} 缺 icon`);

    // 文件里写明的规则：只有一个子项的板块不做下拉（等于让用户白点一次）
    assert.notEqual(g.children.length, 1, `${g.href} 只有 1 个子项，应改为无下级直接链接`);

    for (const c of g.children) {
      assert.ok(c.href.startsWith("/"), `${c.href} 必须以 / 开头`);
      assert.ok(c.label && c.desc, `${c.href} 缺 label 或 desc`);
    }
  }

  // 子项 href 跨板块唯一：否则面包屑会匹配到错误的板块
  const childHrefs = NAV.flatMap((g) => g.children.map((c) => c.href));
  assert.equal(new Set(childHrefs).size, childHrefs.length, "子项 href 不得跨板块重复");
}

// 专业版入口必须在导航里（否则能力分散在各页，用户拼不出"专业版是什么"）
{
  const pro = NAV.find((g) => g.href === "/pro");
  assert.ok(pro, "专业版必须是一级导航板块");
  assert.ok(pro.children.some((c) => c.href === "/pro"), "工作台入口缺失");
  assert.ok(pro.children.some((c) => c.href === "/pricing"), "能力对照入口缺失");
}

// 面包屑：首页与认证页不显示
{
  assert.equal(labels("/"), "");
  assert.equal(labels("/login"), "");
  assert.equal(labels("/register"), "");
}

// 面包屑：专业版两页必须给出语义化层级，不能退回成「概览」
{
  assert.equal(labels("/pro"), "首页 / 专业版 / 工作台");
  assert.equal(labels("/pricing"), "首页 / 专业版 / 能力对照");
}

// 面包屑：板块首页与直系子模块
{
  assert.equal(labels("/macro"), "首页 / 宏观总览 / 宏观仪表盘");
  assert.equal(labels("/macro/feeling"), "首页 / 宏观总览 / 温度 vs 体感");
  // 带 tab 的板块首页用子模块标签（/market?tab=stocks → 个股行情）
  assert.equal(labels("/market", new URLSearchParams("tab=stocks")), "首页 / 市场洞察 / 个股行情");
  assert.equal(labels("/market", new URLSearchParams("tab=etf")), "首页 / 市场洞察 / ETF 专区");
}

// 面包屑末级标签必须与导航下拉用**同一个词**（原先各写一份已经漂移过：
// /macro 下拉叫「宏观仪表盘」而面包屑显示「概览」）
{
  for (const g of NAV) {
    if (g.children.length === 0) continue;
    const self = g.children.find((c) => c.href === g.href);
    if (!self) continue;
    assert.equal(
      labels(g.href),
      `首页 / ${g.label} / ${self.label}`,
      `${g.href} 的面包屑末级与导航标签不一致`
    );
  }
}

// 无下级的板块不追加同名层级（否则是「首页 / 产业地图 / 产业地图」）
{
  const industry = NAV.find((g) => g.href === "/industry");
  assert.equal(industry.children.length, 0);
  assert.equal(labels("/industry"), "首页 / 产业地图");
}

// 面包屑：跨组直链子模块（/sector 不以所属板块前缀开头）与详情页
{
  assert.equal(labels("/sector"), "首页 / 市场洞察 / 板块中心");
  assert.equal(labels("/policy"), "首页 / 宏观总览 / 政策解读");
  assert.equal(labels("/policy/pol123"), "首页 / 政策解读");
  assert.equal(labels("/gmrds/roadmap"), "首页 / 研究体系 / 迭代路线图");
}

// 激活态判定：/pro 与 /pro/xxx 都算激活，/pricing 不算（它是同组子项而非子路径）
{
  assert.equal(isGroupActive("/pro", "/pro"), true);
  assert.equal(isGroupActive("/pro", "/pro/anything"), true);
  assert.equal(isGroupActive("/macro", "/market"), false, "前缀相同但不同板块不得误判");
}

console.log("nav: 8 组断言全过");