/**
 * Max 财经 · 桌面客户端（Electron 外壳）
 *
 * 为什么是「外壳 + 远程 URL」而不是打包一份站点：
 *   本站是 Next.js SSR + 大量服务端 API（行情、估值、AI 解读），
 *   不存在可以静态导出的版本 —— 离线打包只会得到一个没有数据的空壳。
 *   所以客户端加载线上站点，好处是永远与网站同步（不用为每个功能发新版）。
 *
 * 为此必须处理六件事，否则外壳会显得很业余：
 *   1) 断网/加载失败要有像样的提示，而不是 Electron 默认的空白错误页；
 *   2) 站内指向外部域名的链接要用系统浏览器打开，不能在客户端窗口里跳走
 *      （跳走之后没有地址栏，用户回不来）；
 *   3) 窗口大小/位置要记住，每次打开都是默认尺寸很烦；
 *   4) 窗口位置可能落在已拔掉的显示器上（换过扩展屏、拔过投影仪），
 *      必须校验可见性，否则窗口"启动了但看不见"；
 *   5) 下载要能真正落盘（站内 CSV 导出是 a[download] + blob，
 *      默认可能被 Electron 静默丢弃 → 用户点了没反应）；
 *   6) 深链（max://market?tab=etf）要能唤起客户端并直达对应页面。
 *
 * 安全：nodeIntegration 关闭 + contextIsolation 开启 + sandbox 开启，
 * 外壳只暴露一个最小的 preload，不把 Node 能力交给页面；权限请求默认拒绝。
 */
const { app, BrowserWindow, shell, Menu, dialog, screen, session, net } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const { isNewerVersion } = require("./version");

/**
 * 站点地址。默认线上域名；`MAX_SITE` 仅用于本地/预发调试
 * （例如把地址指到 http://127.0.0.1:3000 验证壳层行为），打包后不会设置。
 */
const SITE = process.env.MAX_SITE || "https://www.lune.ink";
const SITE_ORIGIN = new URL(SITE).origin;
const PROTOCOL = "max";
/** 更新检查地址：返回 { version, url, notes }；不存在或 404 时静默跳过 */
const UPDATE_FEED = `${SITE}/desktop/latest.json`;
const STATE_FILE = path.join(app.getPath("userData"), "window-state.json");

/** 窗口还没创建时先存下深链目标，创建后直接打开 */
let pendingDeepLink = null;

/** 读取上次的窗口大小/位置；没有就回退默认值 */
function loadState() {
  try {
    const s = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
    if (s && Number.isFinite(s.width) && Number.isFinite(s.height)) return s;
  } catch {
    /* 首次运行没有状态文件 */
  }
  return { width: 1440, height: 900 };
}

/**
 * 校验记忆的窗口位置是否还落在某块屏幕的可见区域内。
 *
 * 场景：用户在公司用外接 4K 显示器（窗口在 x=2560），回家只剩笔记本屏 ——
 * 不校验就会把窗口恢复到屏幕外，表现为"程序启动了但看不到窗口"。
 * 判定标准取「至少 120×120 在某个工作区内可见」，不要求完整可见（允许用户自己挪）。
 */
function ensureVisibleBounds(state) {
  try {
    const MIN_VISIBLE = 120;
    const probe = {
      x: Number.isFinite(state.x) ? state.x : 0,
      y: Number.isFinite(state.y) ? state.y : 0,
      width: Number.isFinite(state.width) ? state.width : 1440,
      height: Number.isFinite(state.height) ? state.height : 900,
    };
    const visible = screen.getAllDisplays().some((d) => {
      const wa = d.workArea;
      const ix = Math.max(0, Math.min(probe.x + probe.width, wa.x + wa.width) - Math.max(probe.x, wa.x));
      const iy = Math.max(0, Math.min(probe.y + probe.height, wa.y + wa.height) - Math.max(probe.y, wa.y));
      return ix >= MIN_VISIBLE && iy >= MIN_VISIBLE;
    });
    if (visible) return probe;
  } catch {
    /* screen 在 ready 前不可用，理论上不会走到这里 */
  }
  // 位置不可见：只保留尺寸，不记忆位置（让 Electron 居中）
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

/**
 * 把 max:// 深链翻译成站内 URL。
 *
 * 支持两种写法：
 *   max://market?tab=etf        → https://www.lune.ink/market?tab=etf
 *   max://www.lune.ink/market   → https://www.lune.ink/market
 * 其它 scheme/host 一律拒绝（避免被其它站点/恶意链接当成任意 URL 跳板）。
 */
function deepLinkToSiteUrl(raw) {
  if (typeof raw !== "string" || !raw.toLowerCase().startsWith(`${PROTOCOL}://`)) return null;
  const rest = raw.slice(PROTOCOL.length + 3);
  let target;
  if (/^(www\.)?lune\.ink([/?#]|$)/i.test(rest)) target = `https://${rest}`;
  else target = `${SITE}/${rest.replace(/^\/+/, "")}`;
  try {
    const u = new URL(target);
    if (u.origin !== SITE_ORIGIN) return null;
    return u.toString();
  } catch {
    return null;
  }
}

/** 从命令行参数里找深链（Windows/Linux 走这条） */
function findDeepLinkInArgv(argv) {
  for (const a of argv || []) {
    const url = deepLinkToSiteUrl(a);
    if (url) return url;
  }
  return null;
}

/**
 * 加载失败时的兜底页。
 *
 * 早期版本用 `data:text/html;...` 就地生成兜底页，但新版本 Electron 会拦截
 * 顶层导航到 `data:` URL（等同于 `loadURL("data:...")` 被拒），结果兜底页
 * 本身打不开，用户看到的是 Chromium 默认的「网页无法打开」白页 ——
 * 这正是"断网时客户端彻底不可用"的直接原因。
 *
 * 现在改为加载随包分发的本地文件 offline.html：
 *  - 不依赖网络、不依赖站点资源，冷启动即可显示；
 *  - 页面自带「自动重试 + 网络恢复自动返回」逻辑，断网恢复后无需手动重启；
 *  - 错误码/描述通过 query 传进去，方便用户截图反馈。
 */
function offlineFile() {
  return path.join(__dirname, "offline.html");
}

/** 显示本地离线页（避免 did-fail-load 反复触发时把页面重载成死循环） */
function showOfflinePage(win, code, desc) {
  if (!win || win.isDestroyed()) return;
  try {
    const current = win.webContents.getURL() || "";
    if (current.startsWith("file://")) return; // 已经在离线页，别重复加载
  } catch {
    /* getURL 拿不到时按未处理继续 */
  }
  win.loadFile(offlineFile(), {
    query: {
      code: String(code ?? ""),
      desc: String(desc ?? "").slice(0, 120),
    },
  });
}

/**
 * 权限请求统一处理：默认全部拒绝，只放行少量「不涉及隐私、丢了也不会出事」的能力。
 * 站点不需要摄像头/麦克风/定位/通知，一旦某天引入（或第三方脚本引入），
 * 这里会直接拒绝并在日志里留下记录，而不是静默授予。
 */
function installPermissionHandlers() {
  const allow = new Set(["clipboard-sanitized-write", "fullscreen", "pointerLock"]);
  const ses = session.defaultSession;
  ses.setPermissionRequestHandler((_wc, permission, callback) => {
    if (allow.has(permission)) return callback(true);
    console.warn(`[perm] 拒绝权限请求: ${permission}`);
    callback(false);
  });
  ses.setPermissionCheckHandler((_wc, permission) => allow.has(permission));
}

/**
 * 下载落盘。
 *
 * 站内的 CSV/图表导出用 a[download] + blob:，浏览器里会静默变成 Downloads 文件，
 * 而在壳里若不给保存路径，用户看到的就是「点了没反应」。这里统一走系统下载目录，
 * 完成后再提示并可直接在文件夹中定位。
 */
function installDownloadHandler() {
  session.defaultSession.on("will-download", (_event, item, win) => {
    if (!win || win.isDestroyed()) return;
    const filename = item.getFilename() || `max-export-${Date.now()}.csv`;
    const savePath = path.join(app.getPath("downloads"), filename);
    try {
      item.setSavePath(savePath);
    } catch {
      /* 目录不可写时让 Electron 弹自己的保存框 */
      return;
    }
    item.once("done", (_e, state) => {
      if (state !== "completed" || !win || win.isDestroyed()) return;
      dialog
        .showMessageBox(win, {
          type: "info",
          title: "下载完成",
          message: "已保存到「下载」文件夹",
          detail: savePath,
          buttons: ["在文件夹中显示", "好"],
          defaultId: 1,
          cancelId: 1,
        })
        .then((r) => {
          if (r.response === 0) shell.showItemInFolder(savePath);
        })
        .catch(() => {});
    });
  });
}

/** 检查更新：读取静态 JSON，有新版就提示去下载。失败静默（不打扰用户） */
async function checkForUpdates(win) {
  try {
    const res = await net.fetch(UPDATE_FEED, { cache: "no-store" });
    if (!res.ok) return;
    const info = await res.json();
    const latest = String(info?.version || "");
    if (!latest || !isNewerVersion(latest, app.getVersion())) return;
    const url = typeof info?.url === "string" ? info.url : `${SITE}/download`;
    const r = await dialog.showMessageBox(win, {
      type: "info",
      title: "发现新版本",
      message: `Max 财经 ${latest} 已发布（当前 ${app.getVersion()}）`,
      detail: typeof info?.notes === "string" ? info.notes.slice(0, 500) : "建议更新到最新版本。",
      buttons: ["前往下载", "稍后提醒"],
      defaultId: 0,
      cancelId: 1,
    });
    if (r.response === 0) shell.openExternal(url);
  } catch {
    /* 更新检查失败不影响使用 */
  }
}

function createWindow() {
  const state = ensureVisibleBounds(loadState());
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

  win.loadURL(pendingDeepLink || SITE);
  pendingDeepLink = null;

  // 加载失败 → 显示本地离线页（离线可读、自动重试）
  win.webContents.on("did-fail-load", (_e, code, desc, url, isMainFrame) => {
    if (!isMainFrame) return;
    if (code === -3) return; // -3 = ERR_ABORTED，用户主动取消/页面自己跳转，不算错误
    showOfflinePage(win, code, desc);
  });

  // 渲染进程崩溃（常见于内存紧张或 GPU 驱动问题）：给一次自动恢复，别停在空白窗口
  win.webContents.on("render-process-gone", (_e, details) => {
    if (details?.reason === "clean-exit") return;
    console.warn("[renderer] 渲染进程退出:", details?.reason);
    showOfflinePage(win, "renderer-gone", details?.reason || "");
  });

  // 站外链接交给系统浏览器：客户端窗口没有地址栏，跳走就回不来了
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (e, url) => {
    try {
      if (new URL(url).origin !== SITE_ORIGIN) {
        e.preventDefault();
        shell.openExternal(url);
      }
    } catch {
      /* 非法 URL 交给默认处理 */
    }
  });

  // 页面里不允许再嵌 <webview>（站点用不到，且是常见逃逸面）
  win.webContents.on("will-attach-webview", (e) => e.preventDefault());

  // 记住窗口状态（resize/move 事件很密集，用 300ms 防抖避免每帧写盘）
  let saveTimer = null;
  const persist = () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveState(win), 300);
  };
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
        { label: "检查更新", click: () => checkForUpdates(win) },
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

/** 把深链送到已有窗口（同一个窗口内导航，不新开） */
function routeDeepLink(win, raw) {
  const url = deepLinkToSiteUrl(raw);
  if (!url) return;
  if (!win || win.isDestroyed()) {
    pendingDeepLink = url;
    return;
  }
  if (win.isMinimized()) win.restore();
  win.focus();
  win.loadURL(url);
}

// 注册 max:// 协议（打包后生效；开发态需要把 electron 可执行文件带参注册）
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient(PROTOCOL);
}

// Windows 任务栏/通知需要 AppUserModelID，否则分组与通知行为不正常
app.setAppUserModelId("ink.lune.max.desktop");

// 单实例：重复启动时聚焦已有窗口，而不是开出第二个；同时把深链转发过去
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", (_e, argv) => {
    const w = BrowserWindow.getAllWindows()[0];
    if (w) {
      if (w.isMinimized()) w.restore();
      w.focus();
    }
    const deep = findDeepLinkInArgv(argv);
    if (deep) routeDeepLink(w, deep);
  });

  // macOS 的深链从 open-url 来
  app.on("open-url", (e, url) => {
    e.preventDefault();
    routeDeepLink(BrowserWindow.getAllWindows()[0], url);
  });

  app.whenReady().then(() => {
    installPermissionHandlers();
    installDownloadHandler();

    // 冷启动时深链在命令行参数里（Windows/Linux）
    pendingDeepLink = findDeepLinkInArgv(process.argv);

    const win = createWindow();
    buildMenu(win);
    // 启动 8 秒后检查更新：不抢首屏渲染，也避免用户还没看到内容就弹窗
    setTimeout(() => checkForUpdates(win), 8000);

    app.on("activate", () => {
      if (!BrowserWindow.getAllWindows().length) createWindow();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
