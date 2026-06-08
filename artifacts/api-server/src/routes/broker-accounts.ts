import { Router } from "express";
import { db, alpacaAccountsTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import type { Request, Response } from "express";
import { CreateBrokerAccountBody, CreateMyBrokerOrderBody } from "@workspace/api-zod";
import {
  getBrokerConfig,
  brokerEnabled,
  createAccount,
  getAccount,
  getTradingAccount,
  getPositions,
  getOrders,
  createOrder,
  getPortfolioHistory,
  type BrokerConfig,
  type CreateAccountPayload,
} from "../lib/broker-api";
import { logAudit } from "../lib/audit";

const router = Router();

function userKey(req: { userId?: string }): string {
  return req.userId ?? "demo-user";
}

function num(v: unknown): number | null {
  const n = parseFloat(String(v ?? ""));
  return Number.isNaN(n) ? null : n;
}

/** Resolve the signed-in user's brokerage account_id, or null if none/onboarded. */
async function resolveAccountId(req: Request): Promise<string | null> {
  const rows = await db
    .select()
    .from(alpacaAccountsTable)
    .where(
      and(
        eq(alpacaAccountsTable.tenantId, req.tenantId),
        eq(alpacaAccountsTable.userId, userKey(req)),
      ),
    )
    .limit(1);
  return rows[0]?.accountId ?? null;
}

/**
 * Guard shared by the account-scoped trading routes: ensures the Broker API is
 * configured and the user has an account. Returns the resolved context or
 * writes the appropriate error response and returns null.
 */
async function requireAccount(
  req: Request,
  res: Response,
): Promise<{ cfg: BrokerConfig; accountId: string } | null> {
  const cfg = getBrokerConfig();
  if (!cfg) {
    res.status(503).json({ error: "Broker API not configured" });
    return null;
  }
  const accountId = await resolveAccountId(req);
  if (!accountId) {
    res.status(404).json({ error: "No brokerage account for user" });
    return null;
  }
  return { cfg, accountId };
}

// ── GET /broker/accounts/me ──────────────────────────────────────────────────
router.get("/broker/accounts/me", async (req, res): Promise<void> => {
  const cfg = getBrokerConfig();
  const rows = await db
    .select()
    .from(alpacaAccountsTable)
    .where(
      and(
        eq(alpacaAccountsTable.tenantId, req.tenantId),
        eq(alpacaAccountsTable.userId, userKey(req)),
      ),
    )
    .limit(1);
  const row = rows[0];

  if (!row) {
    res.json({ onboarded: false, brokerEnabled: !!cfg });
    return;
  }

  const base = {
    onboarded: true,
    brokerEnabled: !!cfg,
    accountId: row.accountId,
    accountNumber: row.accountNumber,
    status: row.status,
    cryptoStatus: row.cryptoStatus,
    currency: row.currency,
  };

  // Enrich with live status + balances when the Broker API is reachable.
  if (cfg) {
    try {
      const [acct, trading] = await Promise.all([
        getAccount(cfg, row.accountId),
        getTradingAccount(cfg, row.accountId).catch(() => null),
      ]);
      if (acct.status && acct.status !== row.status) {
        await db
          .update(alpacaAccountsTable)
          .set({ status: acct.status, cryptoStatus: acct.crypto_status ?? row.cryptoStatus })
          .where(eq(alpacaAccountsTable.id, row.id));
      }
      res.json({
        ...base,
        status: acct.status ?? row.status,
        cryptoStatus: acct.crypto_status ?? row.cryptoStatus,
        equity: trading ? num(trading.equity) : null,
        cash: trading ? num(trading.cash) : null,
        buyingPower: trading ? num(trading.buying_power) : null,
        portfolioValue: trading ? num(trading.portfolio_value) : null,
      });
      return;
    } catch (err) {
      req.log.error({ err }, "Broker account enrich failed");
    }
  }

  res.json(base);
});

// ── POST /broker/accounts ────────────────────────────────────────────────────
router.post("/broker/accounts", async (req, res): Promise<void> => {
  const cfg = getBrokerConfig();
  if (!cfg) {
    res.status(503).json({ error: "Broker API not configured" });
    return;
  }

  const parsed = CreateBrokerAccountBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const app = parsed.data;

  if (!app.agreedToCustomerAgreement) {
    res.status(400).json({ error: "Customer agreement must be accepted" });
    return;
  }

  const existing = await db
    .select()
    .from(alpacaAccountsTable)
    .where(
      and(
        eq(alpacaAccountsTable.tenantId, req.tenantId),
        eq(alpacaAccountsTable.userId, userKey(req)),
      ),
    )
    .limit(1);
  if (existing[0]) {
    res.status(409).json({ error: "User already has a brokerage account" });
    return;
  }

  const ip =
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    "127.0.0.1";

  const payload: CreateAccountPayload = {
    contact: {
      email_address: app.contact.emailAddress,
      phone_number: app.contact.phoneNumber,
      street_address: app.contact.streetAddress,
      city: app.contact.city,
      state: app.contact.state,
      postal_code: app.contact.postalCode,
    },
    identity: {
      given_name: app.identity.givenName,
      family_name: app.identity.familyName,
      date_of_birth: app.identity.dateOfBirth,
      tax_id: app.identity.taxId,
      tax_id_type: app.identity.taxIdType ?? "USA_SSN",
      country_of_citizenship: app.identity.countryOfCitizenship ?? "USA",
      country_of_birth: app.identity.countryOfBirth ?? "USA",
      country_of_tax_residence: app.identity.countryOfTaxResidence ?? "USA",
      funding_source: app.identity.fundingSource?.length
        ? app.identity.fundingSource
        : ["employment_income"],
    },
    disclosures: {
      is_control_person: app.disclosures?.isControlPerson ?? false,
      is_affiliated_exchange_or_finra: app.disclosures?.isAffiliatedExchangeOrFinra ?? false,
      is_politically_exposed: app.disclosures?.isPoliticallyExposed ?? false,
      immediate_family_exposed: app.disclosures?.immediateFamilyExposed ?? false,
    },
    agreements: [
      {
        agreement: "customer_agreement",
        signed_at: new Date().toISOString(),
        ip_address: ip,
      },
    ],
  };

  try {
    const account = await createAccount(cfg, payload);

    const [saved] = await db
      .insert(alpacaAccountsTable)
      .values({
        tenantId: req.tenantId,
        userId: userKey(req),
        accountId: account.id,
        accountNumber: account.account_number ?? null,
        status: account.status ?? "SUBMITTED",
        cryptoStatus: account.crypto_status ?? null,
        currency: account.currency ?? "USD",
      })
      .returning();

    await logAudit(req, {
      tenantId: req.tenantId,
      userId: req.userId,
      action: "BROKER_ACCOUNT_CREATE",
      metadata: { accountId: account.id, status: account.status },
    });

    res.json({
      onboarded: true,
      brokerEnabled: true,
      accountId: saved.accountId,
      accountNumber: saved.accountNumber,
      status: saved.status,
      cryptoStatus: saved.cryptoStatus,
      currency: saved.currency,
    });
  } catch (err: any) {
    req.log.error({ err: err?.response?.data ?? err }, "Broker account create failed");
    const detail = err?.response?.data?.message ?? "Account creation failed";
    res.status(502).json({ error: detail });
  }
});

// ── GET /broker/accounts/me/positions ────────────────────────────────────────
router.get("/broker/accounts/me/positions", async (req, res): Promise<void> => {
  const ctx = await requireAccount(req, res);
  if (!ctx) return;
  try {
    const positions = await getPositions(ctx.cfg, ctx.accountId);
    res.json(
      positions.map((p) => ({
        symbol: p.symbol,
        qty: num(p.qty) ?? 0,
        marketValue: num(p.market_value) ?? 0,
        unrealizedPl: num(p.unrealized_pl) ?? 0,
        unrealizedPlPct: num(p.unrealized_plpc) ?? 0,
        currentPrice: num(p.current_price),
        entryPrice: num(p.avg_entry_price),
      })),
    );
  } catch (err) {
    req.log.error({ err }, "Broker positions fetch failed");
    res.json([]);
  }
});

// ── GET /broker/accounts/me/orders ───────────────────────────────────────────
function mapOrder(o: any) {
  return {
    id: o.id,
    clientOrderId: o.client_order_id ?? null,
    symbol: o.symbol,
    side: o.side,
    type: o.type ?? o.order_type ?? null,
    timeInForce: o.time_in_force ?? null,
    qty: num(o.qty),
    filledQty: num(o.filled_qty),
    filledAvgPrice: num(o.filled_avg_price),
    limitPrice: num(o.limit_price),
    stopPrice: num(o.stop_price),
    status: o.status,
    submittedAt: o.submitted_at ?? null,
    filledAt: o.filled_at ?? null,
  };
}

router.get("/broker/accounts/me/orders", async (req, res): Promise<void> => {
  const ctx = await requireAccount(req, res);
  if (!ctx) return;
  const status = (req.query.status as string) ?? "all";
  const limit = num(req.query.limit) ?? 50;
  try {
    const orders = await getOrders(ctx.cfg, ctx.accountId, { status, limit });
    res.json(orders.map(mapOrder));
  } catch (err) {
    req.log.error({ err }, "Broker orders fetch failed");
    res.json([]);
  }
});

// ── POST /broker/accounts/me/orders ──────────────────────────────────────────
router.post("/broker/accounts/me/orders", async (req, res): Promise<void> => {
  const parsed = CreateMyBrokerOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const ctx = await requireAccount(req, res);
  if (!ctx) return;

  const o = parsed.data;
  try {
    const order = await createOrder(ctx.cfg, ctx.accountId, {
      symbol: o.symbol,
      qty: o.qty ?? undefined,
      notional: o.notional ?? undefined,
      side: o.side,
      type: o.type ?? "market",
      time_in_force: o.timeInForce ?? "day",
      limit_price: o.limitPrice ?? undefined,
      stop_price: o.stopPrice ?? undefined,
    });
    await logAudit(req, {
      tenantId: req.tenantId,
      userId: req.userId,
      action: "BROKER_ORDER_CREATE",
      metadata: { accountId: ctx.accountId, symbol: o.symbol, side: o.side },
    });
    res.json(mapOrder(order));
  } catch (err: any) {
    req.log.error({ err: err?.response?.data ?? err }, "Broker order create failed");
    res.status(502).json({ error: err?.response?.data?.message ?? "Order failed" });
  }
});

// ── GET /broker/accounts/me/portfolio ────────────────────────────────────────
router.get("/broker/accounts/me/portfolio", async (req, res): Promise<void> => {
  const ctx = await requireAccount(req, res);
  if (!ctx) return;
  try {
    const h = await getPortfolioHistory(ctx.cfg, ctx.accountId, {
      period: (req.query.period as string) ?? "1M",
      timeframe: (req.query.timeframe as string) ?? "1D",
    });
    res.json({
      timestamp: h.timestamp ?? [],
      equity: h.equity ?? [],
      profitLoss: h.profit_loss ?? [],
      profitLossPct: h.profit_loss_pct ?? [],
      baseValue: num(h.base_value),
      timeframe: h.timeframe ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "Broker portfolio history fetch failed");
    res.json({ timestamp: [], equity: [], profitLoss: [], profitLossPct: [], baseValue: null, timeframe: null });
  }
});

export { brokerEnabled };
export default router;
