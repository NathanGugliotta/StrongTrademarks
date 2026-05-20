"use server";

import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { signIn } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";

const schema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(200),
  password: z
    .string()
    .min(8, "At least 8 characters")
    .max(200, "That password is unusually long — try a shorter one"),
});

export async function signUpWithPassword(
  _prev: { error?: string } | null,
  formData: FormData,
): Promise<{ error?: string }> {
  const parsed = schema.safeParse({
    email: formData.get("email"),
    name: formData.get("name"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }
  const { email, name, password } = parsed.data;
  const lower = email.toLowerCase();

  const existing = await db.query.users.findFirst({
    where: eq(users.email, lower),
  });

  if (existing?.passwordHash) {
    return {
      error:
        "An account already exists for this email. Sign in instead.",
    };
  }

  const passwordHash = await bcrypt.hash(password, 12);

  if (existing) {
    // Account was previously created via anonymous submission. Attach a
    // password to it, then sign in.
    await db
      .update(users)
      .set({ passwordHash, name: existing.name ?? name, updatedAt: new Date() })
      .where(eq(users.id, existing.id));
  } else {
    await db.insert(users).values({
      email: lower,
      name,
      passwordHash,
      role: "customer",
    });
  }

  try {
    await signIn("credentials", {
      email: lower,
      password,
      redirectTo: "/dashboard",
    });
  } catch (err) {
    if (
      err &&
      typeof err === "object" &&
      "digest" in err &&
      typeof err.digest === "string" &&
      err.digest.startsWith("NEXT_REDIRECT")
    ) {
      throw err;
    }
    return {
      error: "Account created, but sign-in failed. Try signing in directly.",
    };
  }
  return {};
}
