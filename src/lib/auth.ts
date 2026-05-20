import { redirect } from "next/navigation";
import { auth } from "@/auth";

export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  role: "customer" | "attorney" | "admin";
};

export async function getCurrentUser(): Promise<SessionUser | null> {
  try {
    const session = await auth();
    if (!session?.user) return null;
    return {
      id: session.user.id,
      email: session.user.email ?? "",
      name: session.user.name ?? null,
      role: session.user.role,
    };
  } catch (err) {
    // Auth.js can throw if the underlying session lookup fails (db blip,
    // misconfig, etc.). Treat that as "no session" rather than crashing
    // anonymous-friendly pages.
    console.error("[auth] getCurrentUser failed:", err);
    return null;
  }
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  return user;
}

export async function requireAttorney(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "attorney" && user.role !== "admin") {
    redirect("/");
  }
  return user;
}
