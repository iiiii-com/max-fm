"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "操作失败");
      router.push("/advice");
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="card p-6">
        <h1 className="text-xl font-bold mb-1">{mode === "login" ? "登录 Max 财经" : "注册 Max 财经账号"}</h1>
        <p className="text-sm text-muted mb-6">
          {mode === "login" ? "登录后可生成并保存个人配置建议" : "注册即享：AI 个人建议、自选股、历史记录"}
        </p>
        <form onSubmit={submit} className="space-y-4">
          {mode === "register" && (
            <div>
              <label className="text-sm font-medium block mb-1">昵称</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder="你的称呼" required />
            </div>
          )}
          <div>
            <label className="text-sm font-medium block mb-1">邮箱</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" placeholder="you@example.com" required />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">密码</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="input" placeholder={mode === "register" ? "至少 6 位" : "请输入密码"} minLength={mode === "register" ? 6 : undefined} required />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button type="submit" disabled={loading} className="w-full py-2.5 rounded-lg bg-primary text-white text-sm font-medium disabled:opacity-40">
            {loading ? "处理中…" : mode === "login" ? "登录" : "注册"}
          </button>
        </form>
        <p className="text-sm text-muted mt-4 text-center">
          {mode === "login" ? (
            <>还没有账号？<Link href="/register" className="text-primary hover:underline">立即注册</Link></>
          ) : (
            <>已有账号？<Link href="/login" className="text-primary hover:underline">去登录</Link></>
          )}
        </p>
      </div>
    </div>
  );
}