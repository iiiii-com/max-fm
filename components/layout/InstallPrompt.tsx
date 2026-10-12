"use client";

import { useEffect, useState } from "react";
import { Download, X, Share, Plus } from "lucide-react";

/**
 * 安装入口（双端分别处理）。
 *
 * 两端的安装机制完全不同，必须分开做，不能只放一个按钮：
 *
 *  - Chromium 系（Android / Chrome / Edge 桌面）：会触发 beforeinstallprompt，
 *    我们能拿到一个可编程的安装提示，直接按钮调起即可。装完是**独立窗口**，
 *    没有地址栏 —— 这就是"桌面客户端"。
 *  - iOS Safari：**不支持 beforeinstallprompt**，也没有任何 API 能触发安装，
 *    只能引导用户「分享 → 添加到主屏幕」。给按钮是没用的，必须给步骤图。
 *
 * 另外四条纪律：
 *  1) 已在独立窗口运行时不再提示（display-mode: standalone），否则装完还一直劝装；
 *  2) 用户点「暂不」就记住，不要每次访问都弹 —— 反复劝装是最招人烦的模式；
 *  3) SW 在 **load 之后立刻**注册，不再延迟 2 秒：Chrome 判定"可安装"要求 SW
 *     已注册并接管，延迟注册会连带推迟安装提示出现；
 *  4) 即使自动提示被拒过、或浏览器压根不触发 beforeinstallprompt（部分国产浏览器会屏蔽），
 *     用户仍要能**主动**找到入口 —— 所以监听自定义事件 mx:install，
 *     由页脚的常驻按钮触发，绕过"已拒绝"的记忆。
 */
const DISMISS_KEY = "mx-install-dismissed-at";
/** 拒绝后多久不再自动提示（天） */
const DISMISS_DAYS = 30;
/** 页脚常驻入口用它把卡片调出来 */
export const INSTALL_EVENT = "mx:install";

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [show, setShow] = useState(false);
  const [iosHint, setIosHint] = useState(false);
  /** 由用户主动唤起（而非浏览器自动提示）——此时关闭不计入"拒绝" */
  const [manual, setManual] = useState(false);

  // 注册 Service Worker（仅生产）：load 后立刻注册，不延迟
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* 注册失败不影响站点功能 */
      });
    };
    // load 已过就直接注册；否则等 load（此时首屏已画完，不会抢主线程）
    if (document.readyState === "complete") {
      register();
      return;
    }
    window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, []);

  useEffect(() => {
    // 已是独立窗口 → 不再劝装
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) return;

    const isIos =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.userAgent.includes("Macintosh") && "ontouchend" in document);
    const isSafari = /Safari/.test(navigator.userAgent) && !/CriOS|FxiOS|EdgiOS/.test(navigator.userAgent);
    const recentlyDismissed = () => {
      const t = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
      return t > 0 && Date.now() - t < DISMISS_DAYS * 86400000;
    };

    const onBIP = (e: Event) => {
      e.preventDefault(); // 拦掉浏览器自带的迷你提示，用我们自己的入口
      setDeferred(e as BIPEvent);
      /**
       * 窄屏不自动弹卡片。
       *
       * 手机上这张卡片固定在底部，会盖住 K 线图与控制区 —— 用户正在看行情时
       * 被一个"装到桌面"的浮层挡住，是实打实的干扰。
       * 窄屏只保留页脚的常驻入口（用户想要时自己点），自动提示留给大屏。
       */
      const narrow = window.innerWidth < 640;
      if (!narrow && !recentlyDismissed()) {
        setManual(false);
        setShow(true);
      }
    };
    window.addEventListener("beforeinstallprompt", onBIP);

    // iOS Safari：没有 BIP，只能给手动步骤。同样不在窄屏自动弹，避免遮挡内容。
    if (isIos && isSafari) {
      setIosHint(true);
      if (window.innerWidth >= 640 && !recentlyDismissed()) setShow(true);
    }

    // 页脚常驻入口：用户主动唤起，绕过"已拒绝"的记忆
    const onManual = () => {
      setManual(true);
      setIosHint(isIos && isSafari);
      setShow(true);
    };
    window.addEventListener(INSTALL_EVENT, onManual);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBIP);
      window.removeEventListener(INSTALL_EVENT, onManual);
    };
  }, []);

  const dismiss = () => {
    // 只有自动提示被关掉才记入"暂不"；用户主动点开的关掉不算拒绝
    if (!manual) localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setShow(false);
    setManual(false);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    setDeferred(null);
    setShow(false);
    setManual(false);
    // 用户拒绝时也记一笔，避免马上再弹
    if (outcome !== "accepted") localStorage.setItem(DISMISS_KEY, String(Date.now()));
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-3 left-3 right-3 sm:left-auto sm:right-4 sm:bottom-4 sm:max-w-sm z-50">
      <div className="rounded-lg border border-border bg-card shadow-lg p-3.5">
        <div className="flex items-start gap-2.5">
          <div className="w-8 h-8 rounded-md bg-gradient-to-br from-[#d4203d] to-[#111] text-white font-black text-sm flex items-center justify-center shrink-0">
            M
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">安装到{iosHint ? "主屏幕" : "桌面"}</p>
            {iosHint ? (
              <>
                <p className="text-[11px] text-muted leading-relaxed mt-1">
                  点 Safari 底部的
                  <Share className="inline w-3 h-3 mx-0.5 -mt-0.5" />
                  分享按钮，选「添加到主屏幕」
                  <Plus className="inline w-3 h-3 mx-0.5 -mt-0.5" />
                  ，即可像 App 一样打开。
                </p>
                <p className="text-[10px] text-muted leading-relaxed mt-1.5">
                  iOS 不提供网页触发安装的接口，只能这样手动添加 —— 不是本站缺功能。
                </p>
              </>
            ) : deferred ? (
              <>
                <p className="text-[11px] text-muted leading-relaxed mt-1">
                  装成独立窗口的应用：没有地址栏，从桌面/主屏直接打开，支持离线外壳。
                </p>
                <div className="flex items-center gap-2 mt-2.5">
                  <button
                    onClick={install}
                    className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md bg-primary text-white hover:opacity-90"
                  >
                    <Download className="w-3.5 h-3.5" />
                    立即安装
                  </button>
                  <button onClick={dismiss} className="text-[11px] text-muted hover:text-foreground">
                    暂不
                  </button>
                </div>
              </>
            ) : (
              <p className="text-[11px] text-muted leading-relaxed mt-1">
                你的浏览器没有提供安装接口（部分国产浏览器会屏蔽）。可以改用 Chrome / Edge，
                或在浏览器菜单里找「添加到主屏幕」。
              </p>
            )}
          </div>
          <button onClick={dismiss} className="p-1 text-muted hover:text-foreground shrink-0" aria-label="关闭">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}