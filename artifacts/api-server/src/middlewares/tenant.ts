import type { Request, Response, NextFunction } from "express";
import { getAuth } from "@clerk/express";
import { db, tenantsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

declare global {
  namespace Express {
    interface Request {
      tenantId: number;
      userId?: string;
    }
  }
}

const DEMO_ORG_ID = "demo-org";
const DEMO_USER_ID = "demo-user";

/**
 * Resolves the tenant for each request.
 *
 * Identity is taken from the validated Clerk session first (getAuth), so real
 * multi-tenancy works on any host — not just Replit, whose edge used to inject
 * x-clerk-* headers. We fall back to those headers (legacy/proxy setups) and
 * finally to a shared demo tenant when no auth is configured at all, which
 * keeps the app fully usable in single-tenant mode.
 *
 * The tenant key prefers the Clerk organization id when present (org-based
 * multi-tenancy); otherwise it keys off the user id, so "each user signs into
 * their own account" works even without Clerk Organizations enabled.
 */
export async function tenantMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    let orgId: string | null = null;
    let userId: string | null = null;
    try {
      const auth = getAuth(req);
      orgId = auth.orgId ?? null;
      userId = auth.userId ?? null;
    } catch {
      // clerkMiddleware not active / no session — fall through to headers.
    }

    orgId = orgId || (req.headers["x-clerk-org-id"] as string) || null;
    userId = userId || (req.headers["x-clerk-user-id"] as string) || null;

    // Tenant key: org if available, else the individual user, else demo.
    const tenantKey = orgId || userId || DEMO_ORG_ID;
    const effectiveUserId = userId || DEMO_USER_ID;

    let tenant = await db
      .select()
      .from(tenantsTable)
      .where(eq(tenantsTable.clerkOrgId, tenantKey))
      .limit(1)
      .then((rows) => rows[0]);

    if (!tenant) {
      const [created] = await db
        .insert(tenantsTable)
        .values({ clerkOrgId: tenantKey, name: tenantKey })
        .returning();
      tenant = created;
    }

    req.tenantId = tenant.id;
    req.userId = effectiveUserId;
    next();
  } catch (err) {
    next(err);
  }
}
