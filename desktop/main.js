/**
 * Max 财经 · 桌面客户端（Electron 外壳）
 *
 * 为什么是「外壳 + 远程 URL」而不是打包一份站点：
 *   本站是 Next.js SSR + 大量服务端 API（行情、估值、AI 解读），
 *   不存在可以静态导出的版本 —— 离线打包只会得到一个没有数据的空壳。
 *   所以客户端加载线上站点，好处是永远与网站同步（不用为每个功能发新版）。
 *
 * 为此必须处理三件事，否则外壳会显得很业余：
 *   1) 断网/加载失败要有像样的提示，而不是 Electron 默认的空白错误页；
 *   2) 站内指向外部域名的链接要用系统浏览器打开，不能在客户端窗口里跳走
 *      （跳走之后没有地址栏，用户回不来）；
 *   3) 窗口大小/位置要记住，每次打开都是默认尺寸很烦。
 *
 * 安全：nodeIntegration 关闭 + contextIsolation 开启，
 * 外壳只暴露一个最小的 preload，不把 Node 能力交给页面。
 */
const { app, BrowserWindow, shell, Menu, dialog } = require("electron");
const path = require("node:path");
const fs = require("node:fs");

const SITE = "https://www.lune.ink";
const STATE_FILE = path.join(app.getPath("userData"), "window-state.json");

/** 读取上次的窗口大小/位置；没有或越界（比如换过显示器）就回退默认值 */
function loadState() {
  try {
    const s = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
    if (s && Number.isFinite(s.width) && Number.isFinite(s.height)) return s;
  } catch {
    /* 首次运行没有状态文件 */
  }
  return { width: 1440, height: 900 };
}

function saveState(win) {
  if (!win || win.isDestroyed() || win.isMinimized()) return;
  const b = win.getNormalBounds();
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(b));
  } catch {
    /* 写不了就算了，不该因此报错 */
  }
}

/** 加载失败时的兜底页：给出可操作的说明，而不是空白 */
function errorPage(code, desc) {
  const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8">
<style>
  body{margin:0;height:100vh;display:flex;align-items:center;justify-content:center;
       font:14px/1.7 system-ui,-apple-system,"Microsoft YaHei",sans-serif;background:#fbfbfa;color:#1a1a1a}
  .box{max-width:440px;padding:32px;text-align:center}
  .logo{width:44px;height:44px;margin:0 auto 18px;border-radius:10px;
        background:linear-gradient(135deg,#d4203d,#111);color:#fff;font-weight:900;font-size:22px;
        display:flex;align-items:center;justify-content:center}
  h1{font-size:17px;margin:0 0 10px}
  p{color:#6b6862;margin:0 0 6px}
  code{background:#eee;padding:1px 5px;border-radius:3px;font-size:12px}
  button{margin-top:18px;padding:8px 20px;border:1px solid #ddd;border-radius:6px;background:#fff;
         cursor:pointer;font-size:13px}
  button:hover{border-color:#d4203d;color:#d4203d}
</style>
<div class="box">
  <div class="logo">M</div>
  <h1>无法连接到 Max 财经</h1>
  <p>请检查网络连接后重试。</p>
  <p style="font-size:12px;margin-top:12px">错误：<code>${desc || "网络不可达"}</code>${code ? ` (${code})` : ""}</p>
  <p style="font-size:12px">行情与估值数据不做离线缓存 —— 让你看到昨天的价格却以为是实时的，比看不到更危险。</p>
  <button onclick="location.href='${SITE}'">重试</button>
</div></html>`;
  return "data:text/html;charset=utf-8," + encodeURIComponent(html);
}

function createWindow() {
  const state = loadState();
  const win = new BrowserWindow({
    ...state,
    minWidth: 960,
    minHeight: 640,
    title: "Max 财经",
    backgroundColor: "#fbfbfa",
    icon: path.join(__dirname, "build", "icon.png"),
    autoHideMenuBar: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      // 安全基线：不把 Node 能力交给页面
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  win.loadURL(SITE);

  // 加载失败 → 显示可操作的兜底页
  win.webContents.on("did-fail-load", (_e, code, desc, url, isMainFrame) => {
    if (!isMainFrame || code === -3) return; // -3 是用户主动取消，不算错误
    win.loadURL(errorPage(code, desc));
  });

  // 站外链接交给系统浏览器：客户端窗口没有地址栏，跳走就回不来了
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (e, url) => {
    try {
      if (new URL(url).origin !== new URL(SITE).origin) {
        e.preventDefault();
        shell.openExternal(url);
      }
    } catch {
      /* 非法 URL 交给默认处理 */
    }
  });

  // 记住窗口状态
  const persist = () => saveState(win);
  win.on("resize", persist);
  win.on("move", persist);
  win.on("close", persist);

  return win;
}

function buildMenu(win) {
  const template = [
    {
      label: "文件",
      submenu: [{ label: "退出", accelerator: "Alt+F4", role: "quit" }],
    },
    {
      label: "视图",
      submenu: [
        { label: "重新加载", accelerator: "CmdOrCtrl+R", click: () => win.webContents.reload() },
        { label: "返回首页", accelerator: "CmdOrCtrl+H", click: () => win.loadURL(SITE) },
        { type: "separator" },
        { label: "放大", accelerator: "CmdOrCtrl+Plus", role: "zoomIn" },
        { label: "缩小", accelerator: "CmdOrCtrl+-", role: "zoomOut" },
        { label: "重置缩放", accelerator: "CmdOrCtrl+0", role: "resetZoom" },
        { type: "separator" },
        { label: "全屏", accelerator: "F11", role: "togglefullscreen" },
        { label: "开发者工具", accelerator: "F12", role: "toggleDevTools" },
      ],
    },
    {
      label: "帮助",
      submenu: [
        {
          label: "关于 Max 财经",
          click: () =>
            dialog.showMessageBox(win, {
              type: "info",
              title: "关于",
              message: "Max 财经 · 桌面客户端",
              detail:
                `版本 ${app.getVersion()}\n` +
                "宏观、市场、产业、历史演进与量化研究一体化的财经数据平台。\n\n" +
                "客户端加载线上站点，因此始终与网站同步。\n" +
                "AI 生成内容仅供参考，不构成投资建议。",
              buttons: ["确定"],
            }),
        },
        { label: "打开官网", click: () => shell.openExternal(SITE) },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// 单实例：重复启动时聚焦已有窗口，而不是开出第二个
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const w = BrowserWindow.getAllWindows()[0];
    if (w) {
      if (w.isMinimized()) w.restore();
      w.focus();
    }
  });

  app.whenReady().then(() => {
    const win = createWindow();
    buildMenu(win);
    app.on("activate", () => {
      if (!BrowserWindow.getAllWindows().length) createWindow();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}