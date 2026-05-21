// Email notifications via the same Nodemailer transport configured for
// Auth.js magic links. If EMAIL_SERVER isn't set, notifications log to the
// server console (matches the dev behavior for sign-in links).

import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { applications, users } from "@/db/schema";

const FROM = process.env.EMAIL_FROM ?? "noreply@strongtrademarks.com";

async function sendEmail(args: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<{ ok: boolean; reason?: string }> {
  if (!process.env.EMAIL_SERVER) {
    console.log(
      `\n[notify] Email NOT SENT (EMAIL_SERVER unset)\n  To: ${args.to}\n  Subject: ${args.subject}\n  Body:\n${args.text}\n`,
    );
    return { ok: false, reason: "EMAIL_SERVER not configured" };
  }
  try {
    const { createTransport } = await import("nodemailer");
    const transport = createTransport(process.env.EMAIL_SERVER);
    const result = await transport.sendMail({
      to: args.to,
      from: FROM,
      subject: args.subject,
      text: args.text,
      html: args.html,
    });
    console.log(
      `[notify] Sent: ${args.subject} → ${args.to}. messageId=${result.messageId}`,
    );
    return { ok: true };
  } catch (err) {
    console.error("[notify] Send failed:", err);
    return {
      ok: false,
      reason: err instanceof Error ? err.message : "send failed",
    };
  }
}

function plainHtml(title: string, paragraphs: string[], cta?: { href: string; label: string }): string {
  const body = paragraphs
    .map((p) => `<p style="margin:0 0 12px 0;color:#3f3f46;">${escape(p)}</p>`)
    .join("");
  const button = cta
    ? `<p style="margin: 24px 0;"><a href="${cta.href}" style="background:#18181b;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;display:inline-block;font-family:inherit;">${escape(cta.label)}</a></p>`
    : "";
  return `<!doctype html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#fafafa;padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e4e4e7;border-radius:8px;padding:32px;">
    <h2 style="margin:0 0 16px 0;color:#18181b;">${escape(title)}</h2>
    ${body}
    ${button}
    <p style="margin-top:32px;color:#a1a1aa;font-size:12px;">— StrongTrademarks (operated by Gugliotta &amp; Gugliotta, LPA)</p>
  </div>
</body></html>`;
}

function escape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function preview(body: string, max = 240): string {
  const collapsed = body.replace(/\s+/g, " ").trim();
  return collapsed.length > max ? collapsed.slice(0, max) + "…" : collapsed;
}

function originBase(): string {
  return (
    process.env.AUTH_URL?.replace(/\/$/, "") ??
    "https://strong-trademarks.vercel.app"
  );
}

/**
 * Email the customer that the attorney posted a new message.
 * Target: applications.contactEmail (always set at submission).
 */
export async function notifyCustomerOfMessage(args: {
  applicationId: string;
  authorName: string;
  body: string;
}) {
  const app = await db.query.applications.findFirst({
    where: eq(applications.id, args.applicationId),
  });
  if (!app?.contactEmail) return;

  const docketOrRef = app.docketNumber ?? `application ${args.applicationId.slice(0, 8)}`;
  const url = `${originBase()}/apply/${args.applicationId}/review`;
  const subject = `New message on your trademark application (${docketOrRef})`;
  const text = `${args.authorName} sent you a message about ${docketOrRef}:\n\n"${preview(args.body)}"\n\nReply: ${url}\n`;
  await sendEmail({
    to: app.contactEmail,
    subject,
    text,
    html: plainHtml(
      subject,
      [
        `${args.authorName} sent you a message about ${docketOrRef}:`,
        `"${preview(args.body)}"`,
        `Click below to view the conversation and reply.`,
      ],
      { href: url, label: "View and reply" },
    ),
  });
}

/**
 * Email all attorneys/admins that the customer posted a new message.
 * "Attorneys" = users with role attorney or admin. For v1 this is just
 * the firm's account(s).
 */
export async function notifyAttorneyOfMessage(args: {
  applicationId: string;
  authorName: string;
  body: string;
}) {
  const app = await db.query.applications.findFirst({
    where: eq(applications.id, args.applicationId),
  });
  if (!app) return;

  const attorneys = await db.query.users.findMany({
    where: inArray(users.role, ["attorney", "admin"]),
  });
  if (attorneys.length === 0) return;

  const docketOrRef = app.docketNumber ?? `application ${args.applicationId.slice(0, 8)}`;
  const url = `${originBase()}/admin/applications/${args.applicationId}`;
  const subject = `New customer message on ${docketOrRef}`;
  const text = `${args.authorName} replied on ${docketOrRef}:\n\n"${preview(args.body)}"\n\nView: ${url}\n`;
  const html = plainHtml(
    subject,
    [
      `${args.authorName} replied on ${docketOrRef}:`,
      `"${preview(args.body)}"`,
    ],
    { href: url, label: "Open in admin" },
  );
  await Promise.all(
    attorneys.map((a) =>
      a.email ? sendEmail({ to: a.email, subject, text, html }) : null,
    ),
  );
}
