import { db, apiKeysTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { decrypt } from "./crypto";

export async function getTenantGeminiKey(tenantId: number): Promise<string | undefined> {
  try {
    const rows = await db.select().from(apiKeysTable)
      .where(eq(apiKeysTable.tenantId, tenantId)).limit(1);
    const enc = rows[0]?.geminiApiKeyEnc;
    if (!enc) return undefined;
    return decrypt(enc);
  } catch { return undefined; }
}
