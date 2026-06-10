import express, { type Express } from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";
import router from "./routes";
import healthRouter from "./routes/health";
import { logger } from "./lib/logger";
import { tenantMiddleware } from "./middlewares/tenant";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// Clerk proxy must be mounted before body parsers (streams raw bytes)
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

app.use(cors({ credentials: true, origin: true }));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

// Health check is mounted FIRST — before Clerk and the tenant middleware (which
// hit Clerk's API / the DB) — so /api/healthz always responds 200 even when
// CLERK_SECRET_KEY or DATABASE_URL are unset. This lets Render's health check
// pass and the deploy go live instead of silently showing `no-server`.
app.use("/api", healthRouter);

// Clerk middleware throws on every request when CLERK_SECRET_KEY is missing,
// which would 500 the whole API. Only mount it when a secret key is configured;
// otherwise the app runs single-tenant (tenantMiddleware falls back to the demo
// tenant), so a missing Clerk key degrades gracefully instead of taking the
// server down.
if (process.env.CLERK_SECRET_KEY) {
  app.use(
    clerkMiddleware((req) => ({
      publishableKey: publishableKeyFromHost(
        getClerkProxyHost(req) ?? "",
        process.env.CLERK_PUBLISHABLE_KEY,
      ),
    })),
  );
}

app.use("/api", tenantMiddleware, router);

// Final error handler: API consumers must always receive JSON, never Express's
// default HTML error page. Internals (stack traces, infra error text) are kept
// out of the response body — they go to the structured log instead.
app.use(
  "/api",
  (err: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    req.log?.error?.({ err }, "unhandled API error");
    if (res.headersSent) return;
    res.status(500).json({ error: "Internal server error" });
  },
);

// ── Static frontend (optional) ──────────────────────────────────────────────
// When the motion-scanner web build sits next to this artifact, serve it: the
// API service then doubles as the app host, so one auto-deploying Render
// service carries the whole product (no separate static site required). API
// routes above always win; every other GET falls back to index.html so SPA
// deep links like /scanner resolve.
const hereDir =
  typeof __dirname !== "undefined"
    ? __dirname
    : path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(
  hereDir,
  "..",
  "..",
  "motion-scanner",
  "dist",
  "public",
);
if (fs.existsSync(path.join(publicDir, "index.html"))) {
  app.use(express.static(publicDir));
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api")) return next();
    res.sendFile(path.join(publicDir, "index.html"));
  });
  logger.info({ publicDir }, "serving static frontend alongside the API");
}

export default app;
