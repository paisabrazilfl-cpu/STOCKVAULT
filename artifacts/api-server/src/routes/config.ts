import { Router } from "express";
import { db, scanConfigsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { UpdateConfigBody } from "@workspace/api-zod";
import { DEFAULT_CONFIG } from "../lib/scanner";
import { logAudit } from "../lib/audit";

const router = Router();

router.get("/config", async (req, res): Promise<void> => {
  // DB-less / single-tenant mode: settings must still render. When the
  // database is unreachable we serve the in-memory defaults (read-only).
  try {
    const rows = await db.select().from(scanConfigsTable)
      .where(eq(scanConfigsTable.tenantId, req.tenantId)).limit(1);
    let row = rows[0];
    if (!row) {
      const [created] = await db.insert(scanConfigsTable)
        .values({ tenantId: req.tenantId, config: DEFAULT_CONFIG }).returning();
      row = created;
    }
    res.json({ id: row.id, config: row.config, updatedAt: row.updatedAt.toISOString() });
  } catch (err) {
    req.log?.warn?.({ err }, "config: DB unreachable — serving DEFAULT_CONFIG");
    res.json({ id: 0, config: DEFAULT_CONFIG, updatedAt: new Date().toISOString() });
  }
});

router.put("/config", async (req, res): Promise<void> => {
  const parsed = UpdateConfigBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  try {
    const rows = await db.select().from(scanConfigsTable)
      .where(eq(scanConfigsTable.tenantId, req.tenantId)).limit(1);

    let row;
    if (rows.length === 0) {
      const [created] = await db.insert(scanConfigsTable)
        .values({ tenantId: req.tenantId, config: parsed.data.config as Record<string, unknown> }).returning();
      row = created;
    } else {
      const [updated] = await db.update(scanConfigsTable)
        .set({ config: parsed.data.config as Record<string, unknown> })
        .where(eq(scanConfigsTable.tenantId, req.tenantId)).returning();
      row = updated;
    }

    await logAudit(req, { tenantId: req.tenantId, userId: req.userId, action: "CONFIG_UPDATE" });
    res.json({ id: row.id, config: row.config, updatedAt: row.updatedAt.toISOString() });
  } catch (err) {
    req.log?.warn?.({ err }, "config: DB unreachable — cannot persist settings");
    res.status(503).json({ error: "Settings can't be saved without a database connection. Live search still works." });
  }
});

export default router;
