import type { Request } from "express";
import { db, apiKeysTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { decrypt } from "./crypto";

export interface AlpacaCreds {
  key: string;
  secret: string;
  paper: boolean;
  /** Where the credentials came from — useful for auditing/debugging. */
  source: "env" | "tenant";
}

function decryptKey(enc: string | null | undefined): string | null {
  if (!enc) return null;
  try {
    return decrypt(enc);
  } catch {
    return null;
  }
}

/**
 * Server-wide Alpaca credentials sourced from the environment (the operator's
 * own account, "wired in" for this version). Supports both the canonical
 * Alpaca SDK names (APCA_API_KEY_ID / APCA_API_SECRET_KEY) and the friendlier
 * ALPACA_* aliases.
 *
 * ALPACA_PAPER defaults to true — set it to "false" / "0" to trade live.
 */
function envCreds(): AlpacaCreds | null {
  const key = process.env.APCA_API_KEY_ID ?? process.env.ALPACA_API_KEY_ID;
  const secret =
    process.env.APCA_API_SECRET_KEY ?? process.env.ALPACA_API_SECRET_KEY;
  if (!key || !secret) return null;

  const paperRaw = (process.env.ALPACA_PAPER ?? "true").toLowerCase();
  const paper = paperRaw !== "false" && paperRaw !== "0" && paperRaw !== "no";

  return { key, secret, paper, source: "env" };
}

/**
 * Resolves the Alpaca credentials to use for a request.
 *
 * Order of precedence:
 *   1. Server-configured env credentials (the operator's account).
 *   2. The tenant's own stored keys (legacy per-org configuration).
 *
 * Returns null when nothing is configured.
 */
export async function getAlpacaCreds(
  req: Pick<Request, "tenantId">,
): Promise<AlpacaCreds | null> {
  const fromEnv = envCreds();
  if (fromEnv) return fromEnv;

  const rows = await db
    .select()
    .from(apiKeysTable)
    .where(eq(apiKeysTable.tenantId, req.tenantId))
    .limit(1);
  const row = rows[0];

  const key = decryptKey(row?.alpacaApiKeyEnc);
  const secret = decryptKey(row?.alpacaSecretKeyEnc);
  if (!key || !secret) return null;

  return { key, secret, paper: row?.alpacaPaper ?? true, source: "tenant" };
}

/** True when server-wide Alpaca credentials are present in the environment. */
export function hasEnvAlpacaCreds(): boolean {
  return envCreds() !== null;
}

export function alpacaBaseUrl(paper: boolean): string {
  return paper
    ? "https://paper-api.alpaca.markets"
    : "https://api.alpaca.markets";
}

export function alpacaHeaders(creds: AlpacaCreds): Record<string, string> {
  return {
    "APCA-API-KEY-ID": creds.key,
    "APCA-API-SECRET-KEY": creds.secret,
  };
}
