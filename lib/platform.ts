/**
 * 运行容器识别。
 *
 * 站点同时跑在三种容器里：浏览器（含 PWA）、Electron 桌面壳、Capacitor Android 壳。
 * 少数交互必须区分容器 —— 最典型的是「下载文件」：浏览器里 a[download] + blob 正常，
 * Electron 已由主进程接住（见 desktop/main.js 的 will-download），而 Capacitor WebView
 * 对 blob: 下载既不触发 DownloadListener 也没有文件系统权限，点了只会静默失败。
 * 与其让用户点一个没反应的按钮，不如明确告诉他去哪里下载。
 */

type CapacitorGlobal = {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
};

/** 当前是否运行在原生壳（Capacitor iOS/Android）里 */
export function isNativeShell(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
  if (!cap) return false;
  try {
    if (typeof cap.isNativePlatform === "function") return cap.isNativePlatform();
    const p = typeof cap.getPlatform === "function" ? cap.getPlatform() : "";
    return p === "android" || p === "ios";
  } catch {
    return false;
  }
}

/** 当前是否运行在 Electron 桌面壳里（壳会在 UA 里带 Electron 标识） */
export function isElectronShell(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Electron/i.test(navigator.userAgent);
}

/**
 * 原生壳内下载的统一提示。
 *
 * 不静默失败：用户点了「导出 CSV」必须得到明确反馈与替代路径，
 * 否则会被当成功能坏了（审计里的「App 内导出死按钮」就是这种情况）。
 */
export function notifyNativeDownloadLimitation(): void {
  const message =
    "当前为 App 客户端，暂不支持直接保存文件。\n\n" +
    "请在手机浏览器中打开 www.lune.ink 登录后再导出；" +
    "桌面客户端（Windows）可直接下载到「下载」文件夹。";
  try {
    window.alert(message);
  } catch {
    /* 极端环境下 alert 不可用则静默，不阻塞页面 */
  }
}
