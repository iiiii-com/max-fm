import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import AuthForm from "@/components/AuthForm";
import { bootstrap } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "登录" };

export default async function LoginPage() {
  await bootstrap();
  // 已登录用户不必再看登录页，直接送去个人中心
  const session = await getSession();
  if (session) redirect("/account");

  return (
    <Suspense fallback={null}>
      <AuthForm mode="login" />
    </Suspense>
  );
}