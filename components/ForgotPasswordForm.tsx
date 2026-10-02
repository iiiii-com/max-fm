"use client";

import { useState } from "react";
import Link from "next/link";
import { normalizeEmail } from "@/lib/auth-email-client";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");

    const mail = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mail)) {
      setError("邮箱格式不正确");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizeEmail(mail) }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "请求失败");
      setMessage(json.message);
    } catch (err: any) {
      setError(err.message || "请求失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-10 sm:py-16">
      <div className="mb-6 text-center">
        <h1 className="text-xl font-bold">找回密码</h1>
        <p className="text-sm text-muted mt-1">
          输入注册时使用的邮箱，我们会发送重置链接
        </p>
      </div>

      <div className="card p-6">
        <form onSubmit={submit} noValidate className="space-y-4">
          <div>
            <label htmlFor="fp-email" className="text-sm font-medium block mb-1">
              邮箱
            </label>
            <input
              id="fp-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`input w-full ${error ? "border-red-500" : ""}`}
              placeholder="you@example.com"
              autoComplete="email"
              autoCapitalize="off"
              spellCheck={false}
            />
          </div>

          {error && (
            <p role="alert" className="rounded-md bg-red-500/10 px-3 py-2 text-[13px] text-red-600 dark:text-red-400">
              {error}
            </p>
          )}

          {message && (
            <div className="rounded-md bg-primary/10 px-3 py-3 text-[13px] leading-relaxed">
              <p>{message}</p>
              <p className="mt-1.5 text-muted">
                链接 30 分钟内有效，只能使用一次。若未收到，请检查垃圾邮件，
                或确认邮箱是否注册过本站。
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !!message}
            className="w-full py-2.5 rounded-lg bg-primary text-white text-sm font-medium disabled:opacity-40"
          >
            {loading ? "发送中…" : "发送重置链接"}
          </button>
        </form>

        <p className="text-sm text-muted mt-4 text-center">
          想起来了？
          <Link href="/login" className="text-primary hover:underline ml-1">
            返回登录
          </Link>
        </p>
      </div>
    </div>
  );
}