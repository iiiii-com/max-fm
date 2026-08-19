"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdviceForm() {
  const router = useRouter();
  const [income, setIncome] = useState(2);
  const [risk, setRisk] = useState(3);
  const [horizon, setHorizon] = useState(2);
  const [goal, setGoal] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [report, setReport] = useState("");

  const submit = async () => {
    setLoading(true);
    setError("");
    setReport("");
    try {
      const res = await fetch("/api/advice/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ income, risk, horizon, goal }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "生成失败");
      setReport(json.report);
      router.refresh();
    } catch (e: any) {
      setError(e.message);
      if (e.message.includes("登录")) router.push("/login");
    } finally {
      setLoading(false);
    }
  };

  const options = (labels: string[]) => (
    <div className="flex gap-1.5 flex-wrap">
      {labels.map((l, i) => (
        <button key={l} type="button" onClick={() => setRisk(i + 1)} className={`px-3 py-1 rounded-md text-xs border transition-colors ${risk === i + 1 ? "border-primary bg-primary/10 text-primary font-semibold" : "border-border hover:border-primary/40"}`}>{l}</button>
      ))}
    </div>
  );

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-medium mb-1.5">月收入水平</p>
        <input type="range" min={1} max={5} step={1} value={income} onChange={(e) => setIncome(Number(e.target.value))} className="w-full accent-[var(--primary)]" />
        <div className="flex justify-between text-xs text-muted"><span>5k 以下</span><span>5k-1万</span><span>1万-2万</span><span>2万-5万</span><span>5万+</span></div>
      </div>
      <div>
        <p className="text-sm font-medium mb-1.5">风险承受能力（1 保守 ~ 5 进取）</p>
        {options(["保守", "稳健偏保守", "稳健", "平衡", "进取"])}
      </div>
      <div>
        <p className="text-sm font-medium mb-1.5">投资期限</p>
        <div className="flex gap-1.5">
          {["1 年内（短期）", "1-3 年（中期）", "3 年以上（长期）"].map((l, i) => (
            <button key={l} type="button" onClick={() => setHorizon(i + 1)} className={`px-3 py-1 rounded-md text-xs border transition-colors ${horizon === i + 1 ? "border-primary bg-primary/10 text-primary font-semibold" : "border-border hover:border-primary/40"}`}>{l}</button>
          ))}
        </div>
      </div>
      <div>
        <p className="text-sm font-medium mb-1.5">理财目标（可选）</p>
        <input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="例如：为 5 年后买房攒首付 / 养老储备 / 资产增值" className="input" />
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      <button onClick={submit} disabled={loading} className="w-full py-2.5 rounded-lg bg-primary text-white text-sm font-medium disabled:opacity-40">
        {loading ? "AI 生成中（约 20 秒）…" : "生成我的专属建议"}
      </button>
      {report && (
        <div className="border-t border-border pt-4">
          <p className="text-xs text-muted mb-2">建议已保存到你的账号，可在刷新后查看历史记录。</p>
          <div className="prose-sm max-h-[420px] overflow-y-auto"><pre className="whitespace-pre-wrap font-sans text-sm">{report}</pre></div>
        </div>
      )}
    </div>
  );
}