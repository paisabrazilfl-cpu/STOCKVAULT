import { db, apiKeysTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { decrypt } from "./crypto";

// Defaults: NVIDIA NIM serving MiniMax M2 (OpenAI-compatible).
export const DEFAULT_AI_BASE_URL = "https://integrate.api.nvidia.com/v1";
export const DEFAULT_AI_MODEL = "minimaxai/minimax-m2.7";

export interface AiConfig {
  apiKey?: string;
  baseUrl: string;
  model: string;
  /** true when the API key comes from server env (operator-level). */
  managed: boolean;
}

/** True when the AI engine key is provided server-side via env. */
export function hasEnvAiKey(): boolean {
  return !!process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
}

/**
 * Resolve the AI engine config for a tenant. Server env takes precedence (the
 * operator's key); otherwise we fall back to the per-tenant encrypted key and
 * stored base URL / model. Base URL and model fall back to the NVIDIA NIM
 * defaults (overridable by env).
 */
export async function getTenantAiConfig(tenantId: number): Promise<AiConfig> {
  const envKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  const envBaseUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const envModel = process.env.AI_MODEL;

  let row: typeof apiKeysTable.$inferSelect | undefined;
  try {
    const rows = await db
      .select()
      .from(apiKeysTable)
      .where(eq(apiKeysTable.tenantId, tenantId))
      .limit(1);
    row = rows[0];
  } catch {
    row = undefined;
  }

  let tenantKey: string | undefined;
  if (row?.aiApiKeyEnc) {
    try {
      tenantKey = decrypt(row.aiApiKeyEnc);
    } catch {
      tenantKey = undefined;
    }
  }

  return {
    apiKey: envKey || tenantKey,
    baseUrl: envBaseUrl || row?.aiBaseUrl || DEFAULT_AI_BASE_URL,
    model: envModel || row?.aiModel || DEFAULT_AI_MODEL,
    managed: !!envKey,
  };
}
