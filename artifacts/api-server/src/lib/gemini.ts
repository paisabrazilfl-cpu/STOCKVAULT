import { db, apiKeysTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { decrypt } from "./crypto";

export function hasEnvGeminiKey(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

export async function getTenantGeminiKey(tenantId: number): Promise<string | undefined> {
  // Server-wide env var takes precedence (operator-level key, like Alpaca).
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;

  try {
    const rows = await db.select().from(apiKeysTable)
      .where(eq(apiKeysTable.tenantId, tenantId)).limit(1);
    const enc = rows[0]?.geminiApiKeyEnc;
    if (!enc) return undefined;
    return decrypt(enc);
  } catch { return undefined; }
}
