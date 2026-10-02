"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { checkPassword, passwordStrength } from "@/lib/auth-password-client";

const STRENGTH_LABEL = ["", "太弱", "偏弱", "一般", "较强", "很强"];
const STRENGTH_COLOR = ["", "bg-red-500", "bg-orange-500", "bg-amber-500", "bg-lime-500", "bg-emerald-500"];

function ResetPasswordInner() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const strength = useMemo(() => passwordStrength(password), [password]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!token) {
      setError("缺少重置令牌，请重新申请");
      return;
    }
    const pw = checkPassword(password);
    if (!pw.ok) {
      setError(pw.error ?? "密码不符合要求");
      return;
    }
    if (password !== confirm) {
      setError("两次输入的密码不一致");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "重置失败");
      setDone(true);
      setTimeout(() => router.push("/account"), 1600);
    } catch (err: any) {
      setError(err.message || "重置失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-10 sm:py-16">
      <div className="mb-6 text-center">
        <h1 className="text-xl font-bold">设置新密码</h1>
        <p className="text-sm text-muted mt-1">
          重置成功后，其他设备的登录状态会同时失效
        </p>
      </div>

      <div className="card p-6">
        {done ? (
          <div className="rounded-md bg-primary/10 px-4 py-5 text-center">
            <p className="text-sm font-medium">密码已重置</p>
            <p className="text-[13px] text-muted mt-1">正在带你前往个人中心…</p>
          </div>
        ) : (
          <form onSubmit={submit} noValidate className="space-y-4">
            <div>
              <label htmlFor="rp-pw" className="text-sm font-medium block mb-1">
                新密码
              </label>
              <div className="relative">
                <input
                  id="rp-pw"
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`input w-full ${error ? "border-red-500" : ""}`}
                  placeholder="至少 8 位，含字母和数字"
                  autoComplete="new-password"
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
              {password && (
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

            <div>
              <label htmlFor="rp-pw2" className="text-sm font-medium block mb-1">
                确认新密码
              </label>
              <input
                id="rp-pw2"
                type={showPw ? "text" : "password"}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className={`input w-full ${confirm && confirm !== password ? "border-red-500" : ""}`}
                placeholder="再输入一次"
                autoComplete="new-password"
              />
              {confirm && confirm !== password && (
                <p className="mt-1 text-xs text-red-500">两次输入的密码不一致</p>
              )}
            </div>

            {error && (
              <p role="alert" className="rounded-md bg-red-500/10 px-3 py-2 text-[13px] text-red-600 dark:text-red-400">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg bg-primary text-white text-sm font-medium disabled:opacity-40"
            >
              {loading ? "提交中…" : "确认重置"}
            </button>
          </form>
        )}

        <p className="text-sm text-muted mt-4 text-center">
          链接已过期？
          <Link href="/forgot-password" className="text-primary hover:underline ml-1">
            重新申请
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function ResetPasswordForm() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordInner />
    </Suspense>
  );
}