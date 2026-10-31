import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // 双驱动数据库（SQLite/Postgres）模式下 drizzle 实例刻意使用 any，
      // 且模板/降级内容中 any 为常见形态，统一放行。
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      // 本项目尚未启用 React Compiler。下面两条是 eslint-plugin-react-hooks v7 中
      // 为 Compiler 迁移准备的规则，命中点（如在 effect 里同步 setState 重置派生状态、
      // 在 render 期间读取 ref 做测量）是既有图表/工作台代码的既定写法，
      // 逐条改写会改变渲染时序，风险远大于收益，故保留为 warning 继续暴露，
      // 不阻塞 lint 门禁；真正评估 React Compiler 时再统一迁移。
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // 以下为生成物或不参与 Web 构建的子项目，逐个 lint 只会制造噪音：
    // mobile/ 是 Capacitor 壳（含 android 工程与打包产物），desktop/ 是 Electron 壳，
    // scripts/ 是 node 运维脚本，tmp/ 是本地验证脚本，data/ 是运行时 sqlite 数据。
    "mobile/**",
    "desktop/**",
    "scripts/**",
    "tmp/**",
    "data/**",
    "public/**",
    "coverage/**",
  ]),
]);

export default eslintConfig;
