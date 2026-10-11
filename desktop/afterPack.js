/**
 * electron-builder 的 afterPack 钩子：在应用打包完成、但**生成安装包之前**写入图标与版本信息。
 *
 * 为什么需要这个钩子：
 *   本机无法使用 electron-builder 内置的 winCodeSign（它内含 macOS 符号链接，
 *   Windows 非管理员账户解压时会因无法创建符号链接而失败），因此配置里设了
 *   signAndEditExecutable: false —— 代价是 exe 保留 Electron 默认图标。
 *   afterPack 正好卡在「exe 已生成、安装包还没打」之间，
 *   在这里用独立的 rcedit（不含符号链接，无权限问题）补回图标与版本信息，
 *   安装包与免安装版就都能拿到品牌图标。
 *
 * 若将来启用了 Windows 开发者模式（或改用管理员构建），
 * 可以直接去掉 signAndEditExecutable: false，本钩子会变成幂等的二次写入，无害。
 */
const path = require("node:path");
const fs = require("node:fs");

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== "win32") return;

  const { rcedit } = require("rcedit");
  const exe = path.join(context.appOutDir, "Max 财经.exe");
  const icon = path.join(__dirname, "build", "icon.ico");

  if (!fs.existsSync(exe)) {
    console.warn(`[afterPack] 未找到 ${exe}，跳过图标写入`);
    return;
  }
  if (!fs.existsSync(icon)) {
    console.warn(`[afterPack] 未找到 ${icon}，跳过图标写入`);
    return;
  }

  await rcedit(exe, {
    icon,
    "file-version": "1.0.0",
    "product-version": "1.0.0",
    "version-string": {
      ProductName: "Max 财经",
      FileDescription: "Max 财经 · 桌面客户端",
      CompanyName: "Max 财经",
      LegalCopyright: "© 2026 Max 财经",
    },
  });
  console.log(`[afterPack] 已写入品牌图标与版本信息：${path.basename(exe)}`);
};
