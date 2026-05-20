import NextAuth from "next-auth";
import Nodemailer from "next-auth/providers/nodemailer";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/db";
import {
  accounts,
  sessions,
  users,
  verificationTokens,
} from "@/db/schema";

const FROM = process.env.EMAIL_FROM ?? "noreply@strongtrademarks.com";

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  session: { strategy: "database" },
  providers: [
    Nodemailer({
      // EMAIL_SERVER is only used when set. In dev we short-circuit in
      // sendVerificationRequest below and log the magic link to the server
      // console instead of sending a real email.
      server: process.env.EMAIL_SERVER ?? "smtp://unused:unused@localhost:25",
      from: FROM,
      sendVerificationRequest: async ({ identifier, url, provider }) => {
        if (!process.env.EMAIL_SERVER) {
          console.log(
            `\n[auth] Magic link for ${identifier}:\n  ${url}\n` +
              `  (set EMAIL_SERVER in .env.local to send real emails)\n`,
          );
          return;
        }
        console.log(
          `[auth] Attempting email send to ${identifier} via ${maskServer(String(provider.server))} from ${provider.from}`,
        );
        try {
          const { createTransport } = await import("nodemailer");
          const transport = createTransport(provider.server);
          const result = await transport.sendMail({
            to: identifier,
            from: provider.from,
            subject: "Sign in to StrongTrademarks",
            text: `Sign in to StrongTrademarks:\n\n${url}\n`,
            html: signInEmailHtml(url),
          });
          console.log(
            `[auth] Email send succeeded. messageId=${result.messageId} accepted=${JSON.stringify(result.accepted)} rejected=${JSON.stringify(result.rejected)}`,
          );
        } catch (err) {
          console.error("[auth] Email send FAILED:", err);
          throw err;
        }
      },
    }),
  ],
  pages: {
    signIn: "/sign-in",
    verifyRequest: "/sign-in/verify",
  },
  callbacks: {
    async session({ session, user }) {
      session.user.id = user.id;
      session.user.role =
        (user as { role?: "customer" | "attorney" | "admin" }).role ??
        "customer";
      return session;
    },
  },
});

function maskServer(server: string): string {
  // Hide the password/api-key portion of an smtp:// URL when logging
  return server.replace(/(:\/\/[^:]+:)[^@]+(@)/, "$1***$2");
}

function signInEmailHtml(url: string) {
  return `<!doctype html>
<html><body style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; padding: 24px;">
  <h2 style="margin:0 0 12px 0;">Sign in to StrongTrademarks</h2>
  <p>Click the button below to sign in. The link expires in 24 hours.</p>
  <p style="margin: 24px 0;">
    <a href="${url}" style="background: #18181b; color: #fff; padding: 12px 20px; border-radius: 6px; text-decoration: none; display: inline-block;">Sign in</a>
  </p>
  <p style="color: #71717a; font-size: 13px;">If the button doesn't work, paste this URL into your browser:</p>
  <p style="color: #71717a; font-size: 13px; word-break: break-all;">${url}</p>
</body></html>`;
}
