"use client";

import { useEffect, useState } from "react";
import { INSTALL_EVENT } from "./InstallPrompt";
import { Download } from "lucide-react";

/**
 * 页脚常驻安装入口。
 *
 * 为什么必须有：自动提示有两个天然的失效场景 ——
 *   1) 用户点过「暂不」，30 天内不再弹；
 *   2) 部分国产浏览器（UC/QQ/小米自带等）根本不触发 beforeinstallprompt。
 * 这两种情况下用户就再也找不到安装入口了。页脚这一项是兜底：
 * 主动点它就把安装卡片调出来，且**不受"暂不"记忆约束**。
 *
 * 已在独立窗口运行时（display-mode: standalone）这一项自己隐藏 ——
 * 装完还显示"安装到桌面"是明显的穿帮。
 */
export default function FooterInstallLink() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setVisible(!standalone);
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(INSTALL_EVENT))}
      className="inline-flex items-center gap-1 hover:text-foreground"
    >
      <Download className="w-3 h-3" />
      安装到桌面/主屏
    </button>
  );
}