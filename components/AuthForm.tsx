"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  checkPassword,
  passwordStrength,
} from "@/lib/auth-password-client";

type Mode = "login" | "register";

const STRENGTH_LABEL = ["", "太弱", "偏弱", "一般", "较强", "很强"];
const STRENGTH_COLOR = [
  "",
  "bg-red-500",
  "bg-orange-500",
  "bg-amber-500",
  "bg-lime-500",
  "bg-emerald-500",
];

/** next 参数必须是站内相对路径，否则可能被用于开放重定向 */
function safeNext(raw: string | null): string {
  if (!raw) return "/advice";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/advice";
  return raw;
}

export default function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const params = useSearchParams();
  const nextPath = safeNext(params.get("next"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [fieldErr, setFieldErr] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const isRegister = mode === "register";
  const strength = useMemo(
    () => (isRegister ? passwordStrength(password) : 0),
    [password, isRegister]
  );

  // 前端先校验一遍：省一次往返，也让错误落在字段上而不是只给一句总错误
  const validate = () => {
    const errs: Record<string, string> = {};
    const mail = email.trim();
    if (!mail) errs.email = "请输入邮箱";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mail)) errs.email = "邮箱格式不正确";

    if (!password) errs.password = "请输入密码";
    else if (isRegister) {
      const r = checkPassword(password);
      if (!r.ok) errs.password = r.error ?? "密码不符合要求";
    }

    if (isRegister && !name.trim()) errs.name = "请输入昵称";

    setFieldErr(errs);
    return Object.keys(errs).length === 0;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!validate()) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
          name: name.trim() || undefined,
          remember,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "操作失败");

      router.push(nextPath);
      router.refresh();
    } catch (err: any) {
      setError(err.message || "操作失败");
    } finally {
      setLoading(false);
    }
  };

  const inputCls = (bad?: string) =>
    `input w-full ${bad ? "border-red-500 focus:border-red-500" : ""}`;

  return (
    <div className="mx-auto max-w-md px-4 py-10 sm:py-16">
      <div className="mb-6 text-center">
        <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-white font-bold text-lg mb-3">
          M
        </div>
        <h1 className="text-xl font-bold">
          {isRegister ? "创建账号" : "登录"}
        </h1>
        <p className="text-sm text-muted mt-1">
          {isRegister
            ? "注册后可生成并保存个人配置建议"
            : "登录后同步自选股与个人建议"}
        </p>
      </div>

      <div className="card p-6">
        {/* 登录价值说明：不说明"登录能多得到什么"，用户没有动机 */}
        {!isRegister && (
          <ul className="mb-5 space-y-1.5 border-b border-border pb-4">
            {[
              "AI 个人配置建议，按你的风险偏好生成",
              "自选股与历史记录跨设备同步",
              "提交的市场情绪计入全站情绪聚合",
            ].map((t) => (
              <li key={t} className="flex gap-2 text-[13px] text-muted">
                <span className="text-primary shrink-0">·</span>
                {t}
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={submit} noValidate className="space-y-4">
          {isRegister && (
            <div>
              <label htmlFor="auth-name" className="text-sm font-medium block mb-1">
                昵称
              </label>
              <input
                id="auth-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputCls(fieldErr.name)}
                placeholder="你的称呼"
                autoComplete="nickname"
                maxLength={20}
              />
              {fieldErr.name && <p className="mt-1 text-xs text-red-500">{fieldErr.name}</p>}
            </div>
          )}

          <div>
            <label htmlFor="auth-email" className="text-sm font-medium block mb-1">
              邮箱
            </label>
            <input
              id="auth-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputCls(fieldErr.email)}
              placeholder="you@example.com"
              autoComplete="email"
              autoCapitalize="off"
              spellCheck={false}
            />
            {fieldErr.email && <p className="mt-1 text-xs text-red-500">{fieldErr.email}</p>}
          </div>

          <div>
            <div className="flex items-baseline justify-between mb-1">
              <label htmlFor="auth-password" className="text-sm font-medium">
                密码
              </label>
              {!isRegister && (
                <Link href="/forgot-password" className="text-xs text-primary hover:underline">
                  忘记密码？
                </Link>
              )}
            </div>
            <div className="relative">
              <input
                id="auth-password"
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputCls(fieldErr.password)}
                placeholder={isRegister ? "至少 8 位，含字母和数字" : "请输入密码"}
                autoComplete={isRegister ? "new-password" : "current-password"}
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                aria-label={showPw ? "隐藏密码" : "显示密码"}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted hover:text-foreground px-2 py-1"
              >
                {showPw ? "隐藏" : "显示"}
              </button>
            </div>
            {fieldErr.password && (
              <p className="mt-1 text-xs text-red-500">{fieldErr.password}</p>
            )}

            {isRegister && password && (
              <div className="mt-2 flex items-center gap-2">
                <div className="flex gap-1 flex-1">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded-full ${
                        i <= strength ? STRENGTH_COLOR[strength] : "bg-border"
                      }`}
                    />
                  ))}
                </div>
                <span className="text-[11px] text-muted w-12 text-right">
                  {STRENGTH_LABEL[strength]}
                </span>
              </div>
            )}
          </div>

          {!isRegister && (
            <label className="flex items-center gap-2 text-[13px] text-muted cursor-pointer">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="accent-primary"
              />
              记住我（30 天内免登录）
            </label>
          )}

          {error && (
            <p
              role="alert"
              className="rounded-md bg-red-500/10 px-3 py-2 text-[13px] text-red-600 dark:text-red-400"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-primary text-white text-sm font-medium disabled:opacity-40 transition-opacity"
          >
            {loading ? "处理中…" : isRegister ? "注册" : "登录"}
          </button>
        </form>

        <p className="text-sm text-muted mt-4 text-center">
          {isRegister ? (
            <>已有账号？<Link href="/login" className="text-primary hover:underline">去登录</Link></>
          ) : (
            <>
              还没有账号？
              <Link
                href={`/register${nextPath !== "/advice" ? `?next=${encodeURIComponent(nextPath)}` : ""}`}
                className="text-primary hover:underline"
              >
                立即注册
              </Link>
            </>
          )}
        </p>
      </div>

      <p className="mt-4 text-center text-xs text-muted">
        本站资讯全部公开可读，登录只用于保存你的个人数据。
      </p>
    </div>
  );
}