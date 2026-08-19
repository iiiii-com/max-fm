import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET || "max-dev-secret-change-me-in-production",
);
const COOKIE = "max_session";
const MAX_AGE = 60 * 60 * 24 * 30;

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  provider: string;
  riskLevel: string | null;
  plan: string;
}

export async function createSession(user: SessionUser) {
  const token = await new SignJWT({ id: user.id, email: user.email, name: user.name, provider: user.provider, riskLevel: user.riskLevel, plan: user.plan })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(SECRET);
  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true, secure: process.env.NODE_ENV === "production",
    sameSite: "lax", maxAge: MAX_AGE, path: "/",
  });
}

export async function destroySession() {
  const store = await cookies();
  store.delete(COOKIE);
}

export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as unknown as SessionUser;
  } catch {
    return null;
  }
}

export async function getUserFromDb(id: string) {
  const rows = await db.select().from(s.users).where(eq(s.users.id, id)).limit(1);
  return rows[0] ?? null;
}

export function toSessionUser(u: typeof s.users.$inferSelect): SessionUser {
  const email = u.email ?? "";
  return { id: u.id, email, name: u.name || email.split("@")[0] || "用户", provider: u.provider ?? "", riskLevel: u.riskLevel, plan: u.plan || "free" };
}