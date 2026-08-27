import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ECharts 在 React StrictMode 双挂载下 dispose 与 React DOM 移除竞争，
  // 导致 removeChild NotFoundError → 页面 "This page couldn't load"。
  // 关闭 StrictMode（仅影响 dev 双渲染检查；production 构建不受影响）。
  reactStrictMode: false,
  /* config options here */
};

export default nextConfig;
