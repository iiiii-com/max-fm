"use client";

import { useState } from "react";
import { checkPassword } from "@/lib/auth-password-client";

export default function ChangePasswordCard() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setOk("");

    const pw = checkPassword(newPassword);
    if (!pw.ok) {
      setError(pw.error ?? "密码不符合要求");
      return;
    }
    if (newPassword !== confirm) {
      setError("两次输入的新密码不一致");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "修改失败");
      setOk(json.message || "密码已更新");
      setCurrentPassword("");
      setNewPassword("");
      setConfirm("");
    } catch (err: any) {
      setError(err.message || "修改失败");
    } finally {
      setLoading(false);
    }
  };

  const inputCls = (bad: boolean) => `input w-full ${bad ? "border-red-500" : ""}`;

  return (
    <section className="card p-5">
      <h2 className="font-bold text-sm mb-1">修改密码</h2>
      <p className="text-xs text-muted mb-4">
        修改后除当前设备外的所有登录状态都会失效，需要重新登录。
      </p>

      <form onSubmit={submit} noValidate className="space-y-3 max-w-sm">
        <div>
          <label htmlFor="cp-old" className="text-xs font-medium block mb-1">
            当前密码
          </label>
          <input
            id="cp-old"
            type={showPw ? "text" : "password"}
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className={inputCls(Boolean(error) && !currentPassword)}
            autoComplete="current-password"
          />
        </div>

        <div>
          <label htmlFor="cp-new" className="text-xs font-medium block mb-1">
            新密码
          </label>
          <div className="relative">
            <input
              id="cp-new"
              type={showPw ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={inputCls(Boolean(error) && newPassword.length > 0 && !checkPassword(newPassword).ok)}
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
        </div>

        <div>
          <label htmlFor="cp-new2" className="text-xs font-medium block mb-1">
            确认新密码
          </label>
          <input
            id="cp-new2"
            type={showPw ? "text" : "password"}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={inputCls(confirm.length > 0 && confirm !== newPassword)}
            autoComplete="new-password"
          />
          {confirm && confirm !== newPassword && (
            <p className="mt-1 text-[11px] text-red-500">两次输入的新密码不一致</p>
          )}
        </div>

        {error && (
          <p role="alert" className="rounded-md bg-red-500/10 px-3 py-2 text-[13px] text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
        {ok && (
          <p className="rounded-md bg-primary/10 px-3 py-2 text-[13px]">{ok}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="px-3.5 py-2 rounded-lg bg-primary text-white text-xs font-medium disabled:opacity-40"
        >
          {loading ? "提交中…" : "更新密码"}
        </button>
      </form>
    </section>
  );
}