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
 * 另外三条纪律：
 *  1) 已在独立窗口运行时不再提示（display-mode: standalone），否则装完还一直劝装；
 *  2) 用户点「不再提示」就记住，不要每次访问都弹 —— 反复劝装是最招人烦的模式；
 *  3) 只在生产环境注册 SW：开发时 SW 会把 dev 资源缓存住，改了代码不生效，
 *     是最容易浪费半天的一类问题。
 */
const DISMISS_KEY = "mx-install-dismissed-at";
/** 拒绝后多久不再提示（天） */
const DISMISS_DAYS = 30;

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [show, setShow] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  // 注册 Service Worker（仅生产）
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    // 等页面空闲再注册，不跟首屏抢主线程
    const id = window.setTimeout(() => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* 注册失败不影响站点功能 */
      });
    }, 2000);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    // 已是独立窗口 → 不再劝装
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) return;

    // 用户近期拒绝过 → 不再打扰
    const dismissed = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
    if (dismissed && Date.now() - dismissed < DISMISS_DAYS * 86400000) return;

    const onBIP = (e: Event) => {
      e.preventDefault(); // 拦掉浏览器自带的迷你提示，用我们自己的入口
      setDeferred(e as BIPEvent);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", onBIP);

    // iOS Safari：没有 BIP，只能给手动步骤
    const ua = window.navigator.userAgent;
    const isIos = /iPad|iPhone|iPod/.test(ua) || (ua.includes("Macintosh") && "ontouchend" in document);
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
    if (isIos && isSafari) {
      setIosHint(true);
      setShow(true);
    }

    return () => window.removeEventListener("beforeinstallprompt", onBIP);
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setShow(false);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    setDeferred(null);
    setShow(false);
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
            ) : (
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