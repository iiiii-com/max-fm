"use client";

import { useCallback, useEffect, useState } from "react";

interface Row {
  email: string;
  name: string | null;
  plan: string;
  createdAt: number | null;
}

/**
 * 管理员开通面板。
 *
 * 只在 /account 且服务端判定为管理员时才渲染（服务端 adminGate 是真正的边界，
 * 这里的隐藏只是为了不给普通用户看无关界面）。
 * 列表里直接显示当前版本与操作结果 —— 开通/取消是对账动作，不能是"点一下没反应"。
 */
export default function AdminPlanPanel() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [counts, setCounts] = useState<{ total: number; pro: number } | null>(null);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState("");
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    setErr("");
    try {
      const r = await fetch("/api/admin/plan");
      const j = await r.json();
      if (!r.ok || !j.ok) {
        setErr(j.error ?? "读取失败");
        return;
      }
      setRows(j.users);
      setCounts(j.counts);
    } catch (e: any) {
      setErr(e.message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function setPlan(email: string, plan: "free" | "pro") {
    setBusy(email);
    setMsg("");
    setErr("");
    try {
      const r = await fetch("/api/admin/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, plan }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) {
        setErr(j.error ?? "操作失败");
        return;
      }
      setMsg(j.message + (j.effective ? ` · ${j.effective}` : ""));
      await load();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy("");
    }
  }

  if (err && !rows) return <p className="text-xs text-amber-600">{err}</p>;
  if (!rows) return <p className="text-xs text-muted">读取用户列表…</p>;

  const filtered = q.trim()
    ? rows.filter((r) => r.email.toLowerCase().includes(q.trim().toLowerCase()) || (r.name ?? "").includes(q.trim()))
    : rows;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="按邮箱或姓名过滤"
          className="input max-w-xs"
        />
        {counts && (
          <span className="text-[11px] text-muted">
            共 {counts.total} 个账号 · 专业版 {counts.pro} 个
          </span>
        )}
      </div>

      {msg && <p className="text-[11px] text-emerald-700 dark:text-emerald-400">{msg}</p>}
      {err && <p className="text-[11px] text-amber-600">{err}</p>}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-xs min-w-[520px]">
          <thead>
            <tr className="text-muted text-[10px] border-b border-border bg-border/20">
              <th className="text-left py-2 px-3 font-medium">账号</th>
              <th className="text-left px-3 py-2 font-medium">当前版本</th>
              <th className="text-right px-3 py-2 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.email} className="border-b border-border/40">
                <td className="py-2 px-3">
                  <div className="font-medium">{r.name || r.email.split("@")[0]}</div>
                  <div className="text-[10px] text-muted">{r.email}</div>
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                      r.plan === "pro"
                        ? "border-primary/30 bg-primary/10 text-primary"
                        : "border-border bg-border/40 text-muted"
                    }`}
                  >
                    {r.plan === "pro" ? "专业版" : "普通版"}
                  </span>
                </td>
                <td className="px-3 py-2 text-right">
                  {r.plan === "pro" ? (
                    <button
                      onClick={() => setPlan(r.email, "free")}
                      disabled={busy === r.email}
                      className="text-[11px] px-2 py-0.5 rounded border border-border hover:border-red-400 hover:text-red-600 disabled:opacity-40"
                    >
                      {busy === r.email ? "处理中…" : "取消专业版"}
                    </button>
                  ) : (
                    <button
                      onClick={() => setPlan(r.email, "pro")}
                      disabled={busy === r.email}
                      className="text-[11px] px-2 py-0.5 rounded border border-primary/40 bg-primary/8 text-primary hover:bg-primary/15 disabled:opacity-40"
                    >
                      {busy === r.email ? "处理中…" : "开通专业版"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[10px] text-muted leading-relaxed">
        开通后立即生效（权限每次请求从库读取，不写入登录令牌，用户无需重新登录）。
        每次变更都会写入 task_logs 留痕，记录操作人、目标账号与前后版本。
      </p>
    </div>
  );
}