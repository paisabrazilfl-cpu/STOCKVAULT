import { Router } from "express";
import { ExecuteTradesBody } from "@workspace/api-zod";
import { getAlpacaCreds, alpacaBaseUrl, alpacaHeaders } from "../lib/alpaca";
import { logAudit } from "../lib/audit";

const router = Router();

router.get("/broker/account", async (req, res): Promise<void> => {
  const creds = await getAlpacaCreds(req);
  if (!creds) {
    res.status(503).json({ error: "Alpaca API keys not configured" });
    return;
  }

  try {
    const baseUrl = alpacaBaseUrl(creds.paper);
    const { default: axios } = await import("axios");
    const { data } = await axios.get(`${baseUrl}/v2/account`, {
      headers: alpacaHeaders(creds),
      timeout: 10000,
    });
    const equity = parseFloat(data.equity);
    const lastEquity = parseFloat(data.last_equity ?? data.equity);
    res.json({
      equity, lastEquity,
      buyingPower: parseFloat(data.buying_power),
      cash: parseFloat(data.cash),
      portfolioValue: parseFloat(data.portfolio_value),
      paper: creds.paper,
      dayPl: equity - lastEquity,
      dayPlPct: lastEquity > 0 ? (equity - lastEquity) / lastEquity : 0,
    });
  } catch (err: any) {
    req.log.error({ err }, "Alpaca account fetch failed");
    res.status(502).json({ error: "Broker request failed" });
  }
});

router.get("/broker/positions", async (req, res): Promise<void> => {
  const creds = await getAlpacaCreds(req);
  if (!creds) { res.json([]); return; }

  try {
    const baseUrl = alpacaBaseUrl(creds.paper);
    const { default: axios } = await import("axios");
    const { data } = await axios.get(`${baseUrl}/v2/positions`, {
      headers: alpacaHeaders(creds),
      timeout: 10000,
    });
    res.json((data as any[]).map((p) => ({
      symbol: p.symbol, qty: parseFloat(p.qty),
      marketValue: parseFloat(p.market_value),
      unrealizedPl: parseFloat(p.unrealized_pl),
      unrealizedPlPct: parseFloat(p.unrealized_plpc),
      currentPrice: parseFloat(p.current_price),
      entryPrice: parseFloat(p.avg_entry_price),
    })));
  } catch { res.json([]); }
});

router.post("/broker/execute", async (req, res): Promise<void> => {
  const parsed = ExecuteTradesBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { candidates, dryRun } = parsed.data;

  const creds = dryRun ? null : await getAlpacaCreds(req);
  if (!dryRun && !creds) {
    res.status(503).json({ error: "Alpaca API keys not configured" });
    return;
  }

  await logAudit(req, {
    tenantId: req.tenantId, userId: req.userId,
    action: "BROKER_EXECUTE",
    metadata: { dryRun, tickerCount: candidates.length, source: creds?.source },
  });

  // Dry run never touches Alpaca — just echoes the intended orders.
  if (dryRun || !creds) {
    res.json(candidates.map((c) => ({
      ok: true, ticker: c.ticker, orderId: null, qty: 0,
      entry: c.technical?.close ?? 0,
      target: c.monteCarlo?.target_price ?? 0,
      stop: c.monteCarlo?.stop_price ?? 0,
      reason: "DRY_RUN",
    })));
    return;
  }

  const baseUrl = alpacaBaseUrl(creds.paper);
  const { default: axios } = await import("axios");

  const results = await Promise.all(candidates.map(async (c) => {
    const entry = c.technical?.close ?? 0;
    const target = c.monteCarlo?.target_price ?? 0;
    const stop = c.monteCarlo?.stop_price ?? 0;
    try {
      const { data } = await axios.post(
        `${baseUrl}/v2/orders`,
        {
          symbol: c.ticker,
          qty: 1,
          side: "buy",
          type: "market",
          time_in_force: "day",
        },
        { headers: alpacaHeaders(creds), timeout: 10000 },
      );
      return {
        ok: true, ticker: c.ticker, orderId: data.id ?? null,
        qty: parseFloat(data.qty ?? "1"), entry, target, stop,
        reason: "SUBMITTED",
      };
    } catch (err: any) {
      req.log.error({ err, ticker: c.ticker }, "Alpaca order submit failed");
      const reason = err?.response?.data?.message ?? "SUBMIT_FAILED";
      return { ok: false, ticker: c.ticker, orderId: null, qty: 0, entry, target, stop, reason };
    }
  }));

  res.json(results);
});

export default router;
