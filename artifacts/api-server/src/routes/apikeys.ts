import { Router } from "express";
import { db, apiKeysTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { UpdateApiKeysBody } from "@workspace/api-zod";
import { encrypt } from "../lib/crypto";
import { hasEnvAlpacaCreds } from "../lib/alpaca";
import { hasEnvBrokerConfig } from "../lib/broker-api";
import { hasEnvGeminiKey } from "../lib/gemini";
import { hasEnvAiKey, DEFAULT_AI_BASE_URL, DEFAULT_AI_MODEL } from "../lib/ai-engine";
import { logAudit } from "../lib/audit";
import type { ApiKey } from "@workspace/db";

const router = Router();

function isSet(enc: string | null | undefined): boolean {
  return !!enc;
}

/** Build the public status payload from a stored row + env presence. */
function statusOf(row: ApiKey | undefined) {
  return {
    // Server-wide env credentials (the operator's account) count as configured.
    alpacaConfigured: hasEnvAlpacaCreds() || isSet(row?.alpacaApiKeyEnc),
    alpacaManaged: hasEnvAlpacaCreds(),
    alpacaBrokerConfigured: hasEnvBrokerConfig() || isSet(row?.alpacaBrokerApiKeyEnc),
    alpacaBrokerManaged: hasEnvBrokerConfig(),
    alpacaBrokerSandbox: row?.alpacaBrokerSandbox ?? true,
    tradierConfigured: isSet(row?.tradierApiKeyEnc),
    polygonConfigured: isSet(row?.polygonApiKeyEnc),
    finnhubConfigured: isSet(row?.finnhubApiKeyEnc),
    discordConfigured: isSet(row?.discordWebhookUrlEnc),
    geminiConfigured: hasEnvGeminiKey() || isSet(row?.geminiApiKeyEnc),
    geminiManaged: hasEnvGeminiKey(),
    aiConfigured: hasEnvAiKey() || isSet(row?.aiApiKeyEnc),
    aiManaged: hasEnvAiKey(),
    aiBaseUrl: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || row?.aiBaseUrl || DEFAULT_AI_BASE_URL,
    aiModel: process.env.AI_MODEL || row?.aiModel || DEFAULT_AI_MODEL,
    alpacaPaper: row?.alpacaPaper ?? true,
  };
}

router.get("/api-keys", async (req, res): Promise<void> => {
  // Degrade gracefully without a database: still report env-managed providers
  // and the AI engine defaults so Settings renders sensible state. Per-tenant
  // stored keys simply show as not-configured until a DB is available.
  let row: ApiKey | undefined;
  try {
    const rows = await db.select().from(apiKeysTable)
      .where(eq(apiKeysTable.tenantId, req.tenantId)).limit(1);
    row = rows[0];
  } catch {
    row = undefined;
  }
  res.json(statusOf(row));
});

router.put("/api-keys", async (req, res): Promise<void> => {
  const parsed = UpdateApiKeysBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const d = parsed.data;

  const existing = await db.select().from(apiKeysTable)
    .where(eq(apiKeysTable.tenantId, req.tenantId)).limit(1);

  const patch: Record<string, unknown> = { tenantId: req.tenantId };
  if (d.alpacaApiKey != null) patch.alpacaApiKeyEnc = d.alpacaApiKey ? encrypt(d.alpacaApiKey) : null;
  if (d.alpacaSecretKey != null) patch.alpacaSecretKeyEnc = d.alpacaSecretKey ? encrypt(d.alpacaSecretKey) : null;
  if (d.alpacaPaper != null) patch.alpacaPaper = d.alpacaPaper;
  if (d.alpacaBrokerApiKey != null) patch.alpacaBrokerApiKeyEnc = d.alpacaBrokerApiKey ? encrypt(d.alpacaBrokerApiKey) : null;
  if (d.alpacaBrokerSecretKey != null) patch.alpacaBrokerSecretKeyEnc = d.alpacaBrokerSecretKey ? encrypt(d.alpacaBrokerSecretKey) : null;
  if (d.alpacaBrokerSandbox != null) patch.alpacaBrokerSandbox = d.alpacaBrokerSandbox;
  if (d.tradierApiKey != null) patch.tradierApiKeyEnc = d.tradierApiKey ? encrypt(d.tradierApiKey) : null;
  if (d.polygonApiKey != null) patch.polygonApiKeyEnc = d.polygonApiKey ? encrypt(d.polygonApiKey) : null;
  if (d.finnhubApiKey != null) patch.finnhubApiKeyEnc = d.finnhubApiKey ? encrypt(d.finnhubApiKey) : null;
  if (d.discordWebhookUrl != null) patch.discordWebhookUrlEnc = d.discordWebhookUrl ? encrypt(d.discordWebhookUrl) : null;
  if (d.geminiApiKey != null) patch.geminiApiKeyEnc = d.geminiApiKey ? encrypt(d.geminiApiKey) : null;
  if (d.aiApiKey != null) patch.aiApiKeyEnc = d.aiApiKey ? encrypt(d.aiApiKey) : null;
  if (d.aiBaseUrl != null) patch.aiBaseUrl = d.aiBaseUrl || null;
  if (d.aiModel != null) patch.aiModel = d.aiModel || null;

  let row;
  if (existing.length === 0) {
    const [created] = await db.insert(apiKeysTable).values(patch as any).returning();
    row = created;
  } else {
    const { tenantId: _tid, ...updatePatch } = patch;
    const [updated] = await db.update(apiKeysTable)
      .set(updatePatch as any)
      .where(eq(apiKeysTable.tenantId, req.tenantId)).returning();
    row = updated;
  }

  await logAudit(req, { tenantId: req.tenantId, userId: req.userId, action: "API_KEYS_UPDATE" });
  res.json(statusOf(row));
});

export default router;
