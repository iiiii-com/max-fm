import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import AuthForm from "@/components/AuthForm";
import { bootstrap } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "注册" };

export default async function RegisterPage() {
  await bootstrap();
  const session = await getSession();
  if (session) redirect("/account");

  return (
    <Suspense fallback={null}>
      <AuthForm mode="register" />
    </Suspense>
  );
}