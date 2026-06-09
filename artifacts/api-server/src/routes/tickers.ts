import { Router } from "express";
import { db, apiKeysTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { searchTickers } from "../lib/providers";
import { decrypt } from "../lib/crypto";

const router = Router();

/**
 * Resolve the tenant's Polygon/Massive key. Env var takes precedence (operator
 * key); otherwise the per-tenant encrypted key. Returns undefined when neither
 * is set or the DB is unreachable — the route then degrades to empty results.
 */
async function resolveKey(tenantId: number): Promise<string | undefined> {
  const envKey = process.env.POLYGON_API_KEY || process.env.MASSIVE_API_KEY;
  if (envKey) return envKey;
  try {
    const rows = await db.select().from(apiKeysTable).where(eq(apiKeysTable.tenantId, tenantId)).limit(1);
    const enc = rows[0]?.polygonApiKeyEnc;
    if (!enc) return undefined;
    try { return decrypt(enc); } catch { return undefined; }
  } catch {
    return undefined;
  }
}

// GET /api/tickers/search?q=apple&limit=20
router.get("/tickers/search", async (req, res) => {
  const q = String(req.query.q ?? "").trim();
  if (!q) { res.json({ results: [], source: "none" }); return; }

  const limit = Math.min(Math.max(Number(req.query.limit ?? 20) || 20, 1), 100);
  const apiKey = await resolveKey(req.tenantId);
  if (!apiKey) { res.json({ results: [], source: "none" }); return; }

  const results = await searchTickers(q, apiKey, limit);
  const source = process.env.TICKERS_BASE_URL?.includes("massive") ? "massive" : "polygon";
  res.json({ results, source });
});

export default router;
