"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Command,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const HIGHLIGHTS = [
  { title: "一天的连续轨迹", desc: "打卡区间之内，有多少小时没落进时间表" },
  { title: "考勤与工时", desc: "自动判定迟到，工时按任务归集，不重复填报" },
  { title: "趋势与热力图", desc: "26 周回看，定位到底是哪天开始变的" },
];

function BrandMark({ size = "md" }: { size?: "md" | "lg" }) {
  return (
    <span
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-gradient-to-br from-cyan-bright to-primary text-primary-foreground shadow-hairline ${
        size === "lg" ? "size-11" : "size-8"
      }`}
    >
      <Command className={size === "lg" ? "size-5" : "size-4"} />
      <span className="pointer-events-none absolute inset-0 rounded-[10px] ring-1 ring-inset ring-white/25" />
    </span>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "登录失败，请重试");
        return;
      }
      const from = new URLSearchParams(window.location.search).get("from");
      router.replace(from && from.startsWith("/") ? from : "/dashboard");
      router.refresh();
    } catch {
      setError("网络错误，请检查服务是否运行");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      {/* 品牌侧 */}
      <div className="relative hidden overflow-hidden border-r bg-subtle lg:block">
        <div className="relative flex h-full flex-col justify-between p-12 xl:p-16">
          <div className="flex items-center gap-3">
            <BrandMark size="lg" />
            <div>
              <p className="text-[15px] font-semibold tracking-tight">效率工作台</p>
              <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-subtle-foreground">
                Personal Ops Console
              </p>
            </div>
          </div>

          <div className="max-w-md">
            <h1 className="text-[34px] leading-[1.25] tracking-tight">
              一天里，
              <br />
              有多少时间
              <br />
              没被记录
            </h1>
            <p className="mt-5 max-w-sm text-[13px] leading-relaxed text-muted-foreground">
              任务、考勤、工时收在同一处。仪表盘只回答一个问题：在岗的那些小时，有多少真的落进了时间表。
            </p>

            <ul className="mt-10 border-t">
              {HIGHLIGHTS.map((h, i) => (
                <li
                  key={h.title}
                  className="flex items-baseline gap-4 border-b py-2.5 last:border-b-0"
                >
                  <span className="tabular w-6 shrink-0 font-mono text-[11px] text-subtle-foreground">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-medium">{h.title}</span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                      {h.desc}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <p className="font-mono text-[11px] text-subtle-foreground">
            Next.js · Prisma · Recharts · Tailwind CSS v4
          </p>
        </div>
      </div>

      {/* 表单侧 */}
      <div className="flex items-center justify-center px-5 py-12 sm:px-8">
        <div className="w-full max-w-[22rem]">
          <div className="mb-8 flex flex-col items-center gap-3 lg:items-start">
            <div className="lg:hidden">
              <BrandMark size="lg" />
            </div>
            <div className="text-center lg:text-left">
              <h2 className="text-xl font-semibold tracking-tight">欢迎回来</h2>
              <p className="mt-1 text-[13px] text-muted-foreground">
                登录以继续你的效率追踪
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-xs font-medium text-muted-foreground">
                邮箱
              </label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@local.dev"
                className="h-9"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-xs font-medium text-muted-foreground">
                密码
              </label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="h-9"
              />
            </div>

            {error && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-destructive/25 bg-destructive/8 px-3 py-2.5 text-xs text-destructive"
              >
                <AlertCircle className="mt-px size-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              disabled={loading}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" />
                  登录中…
                </>
              ) : (
                "登 录"
              )}
            </Button>
          </form>

          <p className="mt-6 rounded-lg border border-dashed px-3 py-2.5 text-center text-[11px] leading-relaxed text-subtle-foreground">
            默认账号 <span className="font-mono text-muted-foreground">admin@local.dev</span>
            {" / "}
            <span className="font-mono text-muted-foreground">admin123</span>
            <br />
            登录后请尽快修改
          </p>
        </div>
      </div>
    </div>
  );
}
