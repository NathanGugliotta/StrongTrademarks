"use server";

import { signIn } from "@/auth";
import { z } from "zod";

const magicLinkSchema = z.object({
  email: z.string().email(),
});

const passwordSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function isRedirectError(err: unknown): boolean {
  return Boolean(
    err &&
      typeof err === "object" &&
      "digest" in err &&
      typeof (err as { digest?: unknown }).digest === "string" &&
      (err as { digest: string }).digest.startsWith("NEXT_REDIRECT"),
  );
}

export async function sendMagicLink(
  _prev: { error?: string } | null,
  formData: FormData,
): Promise<{ error?: string }> {
  const parsed = magicLinkSchema.safeParse({
    email: formData.get("email"),
  });
  if (!parsed.success) {
    return { error: "Please enter a valid email address." };
  }
  try {
    await signIn("nodemailer", {
      email: parsed.data.email,
      redirectTo: "/dashboard",
    });
  } catch (err) {
    if (isRedirectError(err)) throw err;
    return { error: "Could not send the sign-in email. Please try again." };
  }
  return {};
}

export async function signInWithPassword(
  _prev: { error?: string } | null,
  formData: FormData,
): Promise<{ error?: string }> {
  const parsed = passwordSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: "Please enter your email and password." };
  }
  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: "/dashboard",
    });
  } catch (err) {
    if (isRedirectError(err)) throw err;
    return { error: "Wrong email or password." };
  }
  return {};
}
