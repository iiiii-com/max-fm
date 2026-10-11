# Max 财经 · 手机 App

Capacitor 外壳，加载线上站点 `https://www.lune.ink`。

## 为什么是「外壳 + 远程 URL」而不是把站点打包进去

本站是 Next.js SSR + 大量服务端 API（行情、估值、AI 解读），**不存在可静态导出的版本** ——
离线打包只会得到一个没有数据的空壳。所以 App 加载线上站点，好处是永远与网站同步，
不用为每个功能发一次新版。

## 构建 APK

前置：JDK 21+（Capacitor 8 要求）与 Android SDK。

```bash
cd mobile
npm install
npx cap sync android          # 同步配置与插件到原生工程

cd android
gradlew.bat assembleDebug     # 产出 app/build/outputs/apk/debug/app-debug.apk
```

**JDK 版本坑**：Capacitor 8 的 `sourceCompatibility` 是 21。若本机只有 JDK 17，
会报 `无效的源发行版：21`。用 Android Studio 自带的 JBR（通常 ≥21）即可：

```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
```

## 图标

`scripts/gen-android-icons.ts` 生成，覆盖 mdpi~xxxhdpi 五种密度，
以及 adaptive icon 的前景/背景层（前景字母缩到 108dp 画布的 36%，
落在中心安全区内 —— 否则 Android 裁圆时字母四角会被切掉）。

改了品牌色后重新生成：

```bash
npx tsx scripts/gen-android-icons.ts
```

## 发布版（上架用）

`assembleDebug` 产出的是调试包，可直接安装测试。上架需要签名：

```bash
cd mobile/android
gradlew.bat assembleRelease   # 需先配置签名（keytool 生成 keystore + gradle signingConfig）
```

## 与 PWA 的关系

PWA 已经覆盖了「加到主屏、独立窗口打开」的日常场景，**不需要装任何东西**。
APK 的价值在于：可上架应用商店、可分发安装包、部分国产浏览器屏蔽 PWA 安装时的替代路径。
