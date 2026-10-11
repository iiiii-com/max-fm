# Max 财经 · 桌面客户端

Electron 外壳，加载线上站点 `https://www.lune.ink`。

## 为什么是 Electron 而不是 Tauri

Tauri 更轻（安装包约 5MB，用系统 WebView2），但**在 Windows 上编译需要 MSVC 或 MinGW 链接器**。
本机两者都没有，装 VS Build Tools 要下几个 GB。Electron 不需要原生编译，
今天就能产出可安装的客户端，代价是安装包大（约 78MB，内含 Chromium）。

若之后装了 VS Build Tools，可以换 Tauri 把体积降到 5MB 量级 —— 但先要有能用的东西。

## 构建

```bash
cd desktop
npm install
npm run build          # 产出 dist/Max-Finance-Setup-1.0.0.exe（NSIS 安装包）
npm run build:portable # 只出免安装目录
npm start              # 直接跑起来调试
```

## 图标：为什么有 afterPack.js

本机无法使用 electron-builder 内置的 winCodeSign（它内含 macOS 符号链接，
Windows 非管理员账户解压时因无法创建符号链接而失败），所以 `package.json` 里设了
`signAndEditExecutable: false` —— 代价是 exe 会保留 Electron 默认图标。

`afterPack.js` 钩子卡在「exe 已生成、安装包还没打」之间，用**独立的 rcedit**
（不含符号链接，无权限问题）补回图标与版本信息，因此安装包与免安装版都带品牌图标。

若启用了 Windows 开发者模式（设置 → 隐私和安全性 → 开发者选项），
可以直接删掉 `signAndEditExecutable: false`，本钩子会变成幂等的二次写入，无害。

图标由脚本生成：

```bash
npx tsx scripts/gen-desktop-icon.ts   # desktop/build/icon.png（512）
npx tsx scripts/gen-ico.ts            # desktop/build/icon.ico（16/32/48/64/128/256）
```

## 安全边界

`nodeIntegration: false` + `contextIsolation: true` + `sandbox: true`，
`preload.js` 有意为空 —— 页面拿不到任何 Node 能力。

## 三件「外壳该做的事」

1. **加载失败给可操作的兜底页**，而不是 Electron 默认的空白错误页
2. **站外链接交给系统浏览器** —— 客户端窗口没有地址栏，跳走就回不来了
3. **记住窗口大小与位置**，单实例运行（重复启动聚焦已有窗口）
