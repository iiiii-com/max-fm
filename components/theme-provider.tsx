"use client";

import { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext<{ theme: "light" | "dark"; toggle: () => void }>({
  theme: "dark",
  toggle: () => {},
});

const THEME_KEY = "max-theme";

/**
 * 安全读取 localStorage：
 * Safari 隐私模式、禁用站点存储、无痕容器下访问会抛 SecurityError，
 * 若不在水合期间兜住会导致整个客户端组件树崩溃（整站白屏），因此必须 try/catch。
 */
function readStoredTheme(): "light" | "dark" | null {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    return saved === "light" || saved === "dark" ? saved : null;
  } catch {
    return null;
  }
}

function writeStoredTheme(theme: "light" | "dark") {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* 存储不可用时静默降级：主题仍作用于当前会话 */
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") return "dark";
    const saved = readStoredTheme();
    if (saved) return saved;
    // 终端风格：无显式偏好时默认深色（明暗两档均为深色，此档更沉）
    return "dark";
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const toggle = () => {
    setTheme((prev) => {
      const next = prev === "light" ? "dark" : "light";
      writeStoredTheme(next);
      return next;
    });
  };

  return <ThemeContext.Provider value={{ theme, toggle }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}