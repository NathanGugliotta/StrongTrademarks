"use server";

import { signIn } from "@/auth";
import { z } from "zod";

const inputSchema = z.object({
  email: z.string().email(),
});

export async function sendMagicLink(
  _prev: { error?: string } | null,
  formData: FormData,
): Promise<{ error?: string }> {
  const parsed = inputSchema.safeParse({
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
    // signIn() throws a NEXT_REDIRECT internally for the verify-request flow;
    // re-throw so Next.js can follow it. Any other error becomes a form error.
    if (
      err &&
      typeof err === "object" &&
      "digest" in err &&
      typeof err.digest === "string" &&
      err.digest.startsWith("NEXT_REDIRECT")
    ) {
      throw err;
    }
    return { error: "Could not send the sign-in email. Please try again." };
  }
  return {};
}
