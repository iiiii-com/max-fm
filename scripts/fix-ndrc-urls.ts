/**
 * 修复发改委政策的原文链接（一次性，可重复运行）。
 *
 * 背景：syncFromNdr 曾用列表页的**上一级目录**（…/zcfb/）作 base 解析相对路径，
 * 而列表页里的 href 是 `./202609/t20260928_1407859.html` —— 少了一层 fzggwl/，
 * 于是发改委政策的 source_url 指向不存在的页面（404）。域名真实、路径规整，
 * 点开才知道是坏的，比留空更糟。
 *
 * 实现放在 lib/data/policy-sync.ts 的 repairNdrUrls()：生产是 PG 模式，
 * postbuild 的政策抓取会跳过，这个修复必须能随构建自动跑到，
 * 因此不能只留在这个手动脚本里。本脚本只是它的命令行入口。
 *
 * 运行：npx tsx scripts/fix-ndrc-urls.ts
 */
import { repairNdrUrls } from "@/lib/data/policy-sync";

async function main() {
  const r = await repairNdrUrls();
  if (!r.checked) {
    console.log("没有需要修正的发改委链接（已是正确形态）");
    return;
  }
  console.log(`\n待查 ${r.checked} 条：修正 ${r.fixed} 条，验证失败 ${r.failed} 条（失败的保持原样，不猜）`);
}

main();