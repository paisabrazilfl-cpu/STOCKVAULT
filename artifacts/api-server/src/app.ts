import express, { type Express } from "express";
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

export default app;
