import {
  pgTable,
  text,
  uuid,
  timestamp,
  integer,
  jsonb,
  pgEnum,
  primaryKey,
  date,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import type { AdapterAccountType } from "next-auth/adapters";

export const userRole = pgEnum("user_role", ["customer", "attorney", "admin"]);

export const applicationStatus = pgEnum("application_status", [
  "draft",
  "submitted",
  "paid",
  "in_review",
  "changes_requested",
  "filed",
  "rejected",
]);

export const markType = pgEnum("mark_type", ["word", "design", "combined"]);

export const filingBasis = pgEnum("filing_basis", ["use", "intent_to_use"]);

export const ownerEntityType = pgEnum("owner_entity_type", [
  "individual",
  "sole_proprietor",
  "corporation",
  "llc",
  "partnership",
  "other",
]);

export const paymentStatus = pgEnum("payment_status", [
  "pending",
  "succeeded",
  "failed",
  "refunded",
]);

export const reviewStatus = pgEnum("review_status", [
  "pending",
  "approved",
  "changes_requested",
  "filed",
  "rejected",
]);

export const fileKind = pgEnum("file_kind", [
  // Customer-uploaded at intake
  "specimen",
  "drawing",
  // Attorney-uploaded during/after filing
  "filing_receipt",
  "office_action",
  "office_action_response",
  "registration_certificate",
  "correspondence",
  // Catch-all (either side)
  "other",
]);

export const deadlineKind = pgEnum("deadline_kind", [
  "office_action",
  "statement_of_use",
  "section_8",
  "section_9",
  "ttab",
  "other",
]);

export const users = pgTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("email_verified", { mode: "date", withTimezone: true }),
  name: text("name"),
  image: text("image"),
  // Nullable: anonymous-submission users and magic-link-only users don't
  // have a password set. Credentials provider sign-in is only available for
  // accounts that have hashed a password via /sign-up.
  passwordHash: text("password_hash"),
  role: userRole("role").notNull().default("customer"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    primaryKey({ columns: [account.provider, account.providerAccountId] }),
  ],
);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date", withTimezone: true }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date", withTimezone: true }).notNull(),
  },
  (vt) => [primaryKey({ columns: [vt.identifier, vt.token] })],
);

export const applications = pgTable("applications", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  status: applicationStatus("status").notNull().default("draft"),

  // Firm docket number, format "XX-####". Assigned when payment succeeds and
  // synced to the Google Sheets master docket. Unique to prevent collisions.
  docketNumber: text("docket_number").unique(),

  // Google Drive folder ID for the firm's WRAPPER folder for this matter.
  // Auto-created at docket-assignment time when WRAPPER_DRIVE_FOLDER_ID is
  // configured. The folder lives inside that parent and follows the firm's
  // existing naming convention: "Last, First DOCKET (Mark)".
  driveFolderId: text("drive_folder_id"),
  // Map of subfolder path → Drive folder ID for this matter's WRAPPER. Used
  // to mirror uploaded files into the correct subfolder. Captured at
  // WRAPPER creation time. Keys look like "01 Application/Specimens".
  driveSubfolderIds: jsonb("drive_subfolder_ids").$type<Record<
    string,
    string
  > | null>(),

  // Contact info — the person filling out the form, captured at intake so
  // we have someone to email even before the user account is created.
  contactEmail: text("contact_email"),
  contactName: text("contact_name"),
  contactPhone: text("contact_phone"),

  markType: markType("mark_type"),
  markText: text("mark_text"),
  markDescription: text("mark_description"),

  ownerName: text("owner_name"),
  ownerEntityType: ownerEntityType("owner_entity_type"),
  ownerAddress: jsonb("owner_address").$type<{
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  } | null>(),

  filingBasis: filingBasis("filing_basis"),
  // Required for Section 1(a) "use in commerce" filings. Stored as text in
  // ISO-8601 format (YYYY-MM-DD) — the USPTO accepts partial dates (e.g.
  // "2024-03") in some cases, so we keep flexibility rather than using a
  // strict DATE column.
  firstUseInCommerceDate: text("first_use_in_commerce_date"),
  firstUseAnywhereDate: text("first_use_anywhere_date"),

  goodsServices: jsonb("goods_services").$type<
    Array<{ class: string; description: string }>
  >().default([]),

  // Captured at the point the customer agrees to the USPTO declaration on
  // the review/pay page. declarationSignature is their typed full name.
  declarationVersion: text("declaration_version"),
  declarationSignature: text("declaration_signature"),
  declarationSignedAt: timestamp("declaration_signed_at", { withTimezone: true }),

  // Engagement letter signed at checkout — establishes the actual
  // attorney-client relationship with Gugliotta & Gugliotta, LPA. Stored
  // as both the rendered HTML at the time of signing (for audit) and the
  // signature/timestamp.
  engagementLetterVersion: text("engagement_letter_version"),
  engagementLetterHtml: text("engagement_letter_html"),
  engagementLetterSignature: text("engagement_letter_signature"),
  engagementLetterSignedAt: timestamp("engagement_letter_signed_at", {
    withTimezone: true,
  }),

  submittedAt: timestamp("submitted_at", { withTimezone: true }),

  // Last time each side viewed the message thread, used to compute unread
  // counts for the dashboard / inbox badges. Null = never viewed (all
  // messages count as unread for that side).
  customerLastReadAt: timestamp("customer_last_read_at", {
    withTimezone: true,
  }),
  attorneyLastReadAt: timestamp("attorney_last_read_at", {
    withTimezone: true,
  }),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// feeType is text rather than an enum so we can add more kinds later
// without a migration. Values today:
//   - 'service' : our attorney review & filing fee, paid at intake checkout
//   - 'uspto'   : USPTO government filing fee, invoiced after attorney scoping
export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  applicationId: uuid("application_id")
    .notNull()
    .references(() => applications.id, { onDelete: "cascade" }),
  feeType: text("fee_type").notNull().default("service"),
  stripeSessionId: text("stripe_session_id").unique(),
  stripePaymentIntentId: text("stripe_payment_intent_id").unique(),
  // client_secret of a Stripe Checkout Session opened in ui_mode='embedded'.
  // Used to mount the inline checkout iframe in the message thread.
  // Becomes invalid once the session expires (~24h) — re-issue if so.
  stripeClientSecret: text("stripe_client_secret"),
  amountCents: integer("amount_cents").notNull(),
  currency: text("currency").notNull().default("usd"),
  status: paymentStatus("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const attorneyReviews = pgTable("attorney_reviews", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  applicationId: uuid("application_id")
    .notNull()
    .references(() => applications.id, { onDelete: "cascade" }),
  attorneyId: text("attorney_id").references(() => users.id, { onDelete: "set null" }),
  status: reviewStatus("status").notNull().default("pending"),
  notes: text("notes"),
  filedAt: timestamp("filed_at", { withTimezone: true }),
  usptoSerialNumber: text("uspto_serial_number"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// author_role is the WHO of the message (customer/attorney/system).
// kind is the WHAT — 'text' for normal posts; richer kinds get a
// custom renderer ('filing_fee_invoice' embeds a Stripe checkout, etc.).
// Both intentionally text columns so we can add new values without a
// schema migration.
export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  applicationId: uuid("application_id")
    .notNull()
    .references(() => applications.id, { onDelete: "cascade" }),
  authorId: text("author_id").references(() => users.id, {
    onDelete: "set null",
  }),
  authorRole: text("author_role").notNull(),
  kind: text("kind").notNull().default("text"),
  body: text("body").notNull(),
  paymentId: uuid("payment_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Trademark deadlines per application — office action responses,
// statements of use, Section 8/9 renewals, TTAB filings, etc. v1 is
// manual entry by the attorney. Later we'll auto-populate from USPTO
// TSDR events. due_date is a calendar date (YYYY-MM-DD); we treat the
// deadline as end-of-day for display.
export const deadlines = pgTable("deadlines", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  applicationId: uuid("application_id")
    .notNull()
    .references(() => applications.id, { onDelete: "cascade" }),
  kind: deadlineKind("kind").notNull().default("other"),
  title: text("title").notNull(),
  dueDate: date("due_date").notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  notes: text("notes"),
  createdById: text("created_by_id").references(() => users.id, {
    onDelete: "set null",
  }),
  // Stamps for email reminder dispatch, so the cron is idempotent.
  reminded14At: timestamp("reminded_14_at", { withTimezone: true }),
  reminded7At: timestamp("reminded_7_at", { withTimezone: true }),
  reminded1At: timestamp("reminded_1_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const files = pgTable("files", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  applicationId: uuid("application_id")
    .notNull()
    .references(() => applications.id, { onDelete: "cascade" }),
  kind: fileKind("kind").notNull(),
  // Optional display title — attorney-uploaded docs often have meaningful
  // titles like "Filing receipt (98765432)" or "Office action — Sept 2026".
  // Customer specimens don't need a title; we fall back to the filename.
  title: text("title"),
  url: text("url").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  uploadedById: text("uploaded_by_id").references(() => users.id, {
    onDelete: "set null",
  }),
  // 'customer' or 'attorney' (or 'admin'). Defaults to 'customer' for
  // backward compat with existing rows.
  uploadedByRole: text("uploaded_by_role").notNull().default("customer"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
  applications: many(applications),
  attorneyReviews: many(attorneyReviews),
}));

export const applicationsRelations = relations(applications, ({ one, many }) => ({
  user: one(users, { fields: [applications.userId], references: [users.id] }),
  payments: many(payments),
  reviews: many(attorneyReviews),
  files: many(files),
  messages: many(messages),
  deadlines: many(deadlines),
}));

export const deadlinesRelations = relations(deadlines, ({ one }) => ({
  application: one(applications, {
    fields: [deadlines.applicationId],
    references: [applications.id],
  }),
  createdBy: one(users, {
    fields: [deadlines.createdById],
    references: [users.id],
  }),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  application: one(applications, {
    fields: [messages.applicationId],
    references: [applications.id],
  }),
  author: one(users, {
    fields: [messages.authorId],
    references: [users.id],
  }),
  payment: one(payments, {
    fields: [messages.paymentId],
    references: [payments.id],
  }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  application: one(applications, {
    fields: [payments.applicationId],
    references: [applications.id],
  }),
}));

export const attorneyReviewsRelations = relations(attorneyReviews, ({ one }) => ({
  application: one(applications, {
    fields: [attorneyReviews.applicationId],
    references: [applications.id],
  }),
  attorney: one(users, {
    fields: [attorneyReviews.attorneyId],
    references: [users.id],
  }),
}));

export const filesRelations = relations(files, ({ one }) => ({
  application: one(applications, {
    fields: [files.applicationId],
    references: [applications.id],
  }),
}));
