import { pgTable, serial, timestamp, integer, text, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Per-user Alpaca brokerage account (Broker API model).
 *
 * Each end user gets their OWN Alpaca brokerage account, created via the
 * Broker API KYC flow. We persist the returned account_id and status so we can
 * route account-scoped trading calls (/v1/trading/accounts/:account_id/...).
 */
export const alpacaAccountsTable = pgTable(
  "alpaca_accounts",
  {
    id: serial("id").primaryKey(),
    tenantId: integer("tenant_id").notNull(),
    // Clerk user id (or demo-user). One brokerage account per user.
    userId: text("user_id").notNull(),
    // Alpaca account UUID returned by POST /v1/accounts.
    accountId: text("account_id").notNull(),
    accountNumber: text("account_number"),
    // SUBMITTED, ACTION_REQUIRED, ACTIVE, REJECTED, etc.
    status: text("status").notNull().default("SUBMITTED"),
    cryptoStatus: text("crypto_status"),
    currency: text("currency").default("USD"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    // A user holds at most one brokerage account within a tenant.
    uniqUserPerTenant: unique().on(t.tenantId, t.userId),
  }),
);

export const insertAlpacaAccountSchema = createInsertSchema(alpacaAccountsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertAlpacaAccount = z.infer<typeof insertAlpacaAccountSchema>;
export type AlpacaAccount = typeof alpacaAccountsTable.$inferSelect;
