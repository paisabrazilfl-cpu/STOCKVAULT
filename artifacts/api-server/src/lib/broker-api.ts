/**
 * Alpaca Broker API client.
 *
 * Unlike the Trading API (per-account API-key headers), the Broker API
 * authenticates the *broker partner* with HTTP Basic auth (broker key/secret)
 * and operates on end-user accounts you create and own.
 *
 *   Sandbox: https://broker-api.sandbox.alpaca.markets
 *   Live:    https://broker-api.alpaca.markets
 *
 * Configure via env:
 *   ALPACA_BROKER_API_KEY, ALPACA_BROKER_API_SECRET
 *   ALPACA_BROKER_SANDBOX = "true" (default) | "false"
 */
import type { AxiosInstance } from "axios";

export interface BrokerConfig {
  key: string;
  secret: string;
  sandbox: boolean;
}

export function getBrokerConfig(): BrokerConfig | null {
  const key = process.env.ALPACA_BROKER_API_KEY;
  const secret = process.env.ALPACA_BROKER_API_SECRET;
  if (!key || !secret) return null;
  const sandboxRaw = (process.env.ALPACA_BROKER_SANDBOX ?? "true").toLowerCase();
  const sandbox = sandboxRaw !== "false" && sandboxRaw !== "0" && sandboxRaw !== "no";
  return { key, secret, sandbox };
}

export function brokerEnabled(): boolean {
  return getBrokerConfig() !== null;
}

function brokerBaseUrl(sandbox: boolean): string {
  return sandbox
    ? "https://broker-api.sandbox.alpaca.markets"
    : "https://broker-api.alpaca.markets";
}

/** Builds an axios client pre-configured with Basic auth + base URL. */
async function client(cfg: BrokerConfig): Promise<AxiosInstance> {
  const { default: axios } = await import("axios");
  const basic = Buffer.from(`${cfg.key}:${cfg.secret}`).toString("base64");
  return axios.create({
    baseURL: brokerBaseUrl(cfg.sandbox),
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    timeout: 15000,
  });
}

// ── Account model (the subset we expose) ─────────────────────────────────────
export interface BrokerAccount {
  id: string;
  account_number: string;
  status: string;
  crypto_status?: string;
  currency?: string;
  created_at?: string;
}

export interface CreateAccountPayload {
  contact: {
    email_address: string;
    phone_number: string;
    street_address: string[];
    city: string;
    state: string;
    postal_code: string;
  };
  identity: {
    given_name: string;
    family_name: string;
    date_of_birth: string;
    tax_id: string;
    tax_id_type: string;
    country_of_citizenship: string;
    country_of_birth: string;
    country_of_tax_residence: string;
    funding_source: string[];
  };
  disclosures: {
    is_control_person: boolean;
    is_affiliated_exchange_or_finra: boolean;
    is_politically_exposed: boolean;
    immediate_family_exposed: boolean;
  };
  agreements: Array<{
    agreement: string;
    signed_at: string;
    ip_address: string;
    revision?: string;
  }>;
}

/** POST /v1/accounts — submit a KYC application for a new brokerage account. */
export async function createAccount(
  cfg: BrokerConfig,
  payload: CreateAccountPayload,
): Promise<BrokerAccount> {
  const c = await client(cfg);
  const { data } = await c.post("/v1/accounts", payload);
  return data as BrokerAccount;
}

/** GET /v1/accounts/:id — fetch a brokerage account by id. */
export async function getAccount(cfg: BrokerConfig, accountId: string): Promise<BrokerAccount> {
  const c = await client(cfg);
  const { data } = await c.get(`/v1/accounts/${accountId}`);
  return data as BrokerAccount;
}

/** GET /v1/trading/accounts/:id/account — trading details (equity, buying power…). */
export async function getTradingAccount(cfg: BrokerConfig, accountId: string): Promise<any> {
  const c = await client(cfg);
  const { data } = await c.get(`/v1/trading/accounts/${accountId}/account`);
  return data;
}

/** GET /v1/trading/accounts/:id/positions */
export async function getPositions(cfg: BrokerConfig, accountId: string): Promise<any[]> {
  const c = await client(cfg);
  const { data } = await c.get(`/v1/trading/accounts/${accountId}/positions`);
  return data as any[];
}

export interface CreateOrderPayload {
  symbol: string;
  qty?: string | number;
  notional?: string | number;
  side: "buy" | "sell";
  type: "market" | "limit" | "stop" | "stop_limit";
  time_in_force: "day" | "gtc" | "ioc" | "fok";
  limit_price?: string | number;
  stop_price?: string | number;
}

/** POST /v1/trading/accounts/:id/orders */
export async function createOrder(
  cfg: BrokerConfig,
  accountId: string,
  order: CreateOrderPayload,
): Promise<any> {
  const c = await client(cfg);
  const { data } = await c.post(`/v1/trading/accounts/${accountId}/orders`, order);
  return data;
}

/** GET /v1/trading/accounts/:id/orders */
export async function getOrders(
  cfg: BrokerConfig,
  accountId: string,
  params: { status?: string; limit?: number } = {},
): Promise<any[]> {
  const c = await client(cfg);
  const { data } = await c.get(`/v1/trading/accounts/${accountId}/orders`, {
    params: { status: params.status ?? "all", limit: params.limit ?? 50 },
  });
  return data as any[];
}

/** GET /v1/trading/accounts/:id/account/portfolio/history */
export async function getPortfolioHistory(
  cfg: BrokerConfig,
  accountId: string,
  params: { period?: string; timeframe?: string } = {},
): Promise<any> {
  const c = await client(cfg);
  const { data } = await c.get(
    `/v1/trading/accounts/${accountId}/account/portfolio/history`,
    { params: { period: params.period ?? "1M", timeframe: params.timeframe ?? "1D" } },
  );
  return data;
}
