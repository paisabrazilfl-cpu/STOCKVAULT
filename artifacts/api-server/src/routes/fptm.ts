import { Router } from "express";
import { scanFullMarket } from "../lib/providers/fullmarket";
import {
  analyzeCandidate,
  decideNextTrade,
  buildDoubleLadder,
  DEFAULT_FPTM_CONFIG,
  type StrategyConfig,
  type StockSnapshot,
} from "../lib/fptm-strategy";

const router = Router();

// Convert CandidateRecord from screener into StockSnapshot for FPTM
function convertToSnapshot(record: any): StockSnapshot {
  const tech = record.technical as any || {};
  return {
    symbol: record.ticker,
    price: Number(tech.price ?? 0),
    high52w: Number(tech.high52w ?? 0),
    low52w: Number(tech.low52w ?? 0),
    monthlyChangePct: (Number(tech.mom1m ?? 0)) * 100,
    marketCap: Number(tech.marketCap ?? 0),
    avgVolume: Number(tech.avgVolume ?? 0),
    currentVolume: Number(tech.volume ?? 0),
    floatShares: Number(tech.floatShares ?? 0),
    hasCatalyst: record.hasCatalyst === true,
    dilutionRisk: record.dilutionRisk ?? "unknown",
    sector: tech.sector,
  };
}

// GET /api/fptm/scan - Screen all candidates using 14-double rules
router.get("/fptm/scan", async (req, res): Promise<void> => {
  try {
    const config = {
      ...DEFAULT_FPTM_CONFIG,
      startingCapital: parseFloat(req.query.startingCapital as string) || DEFAULT_FPTM_CONFIG.startingCapital,
      targetCapital: parseFloat(req.query.targetCapital as string) || DEFAULT_FPTM_CONFIG.targetCapital,
    };

    // Get full market data
    const market = await scanFullMarket();
    if (!market) {
      return res.status(503).json({
        error: "Market data unavailable",
        candidates: [],
        ladder: buildDoubleLadder(config.startingCapital, 14),
      });
    }

    // Convert to snapshots
    const snapshots = market.records
      .map((r: any) => convertToSnapshot(r))
      .filter((s) => s.price > 0);

    // Screen using FPTM rules
    const candidates = snapshots
      .map((stock) => {
        const analysis = analyzeCandidate(stock, config);
        return {
          ...analysis,
          price: stock.price,
          high52w: stock.high52w,
          low52w: stock.low52w,
          monthlyChangePct: stock.monthlyChangePct,
          marketCap: stock.marketCap,
          avgVolume: stock.avgVolume,
          sector: stock.sector,
          verdict: analysis.passed ? "GO" : "ABORT",
          tradePlanExample: analysis.passed
            ? {
                entryPrice: stock.price,
                stopLossPrice: stock.price * 0.75,
                targetPrice: stock.price * 2.0,
                maxPositionValue: (config.startingCapital * config.maxRiskPctPerTrade),
                shares: Math.floor((config.startingCapital * config.maxRiskPctPerTrade) / stock.price),
              }
            : null,
        };
      })
      .filter((c) => c.passed)
      .sort((a, b) => b.score - a.score);

    res.json({
      candidates,
      total: candidates.length,
      scanned: snapshots.length,
      config,
      ladder: buildDoubleLadder(config.startingCapital, 14),
      cachedAt: market.cachedAt.toISOString(),
    });
  } catch (error) {
    console.error("FPTM scan error:", error);
    res.status(500).json({ error: "Scan failed", candidates: [] });
  }
});

// GET /api/fptm/ladder - Get the 14-double ladder
router.get("/fptm/ladder", (req, res): void => {
  const startingCapital = parseFloat(req.query.startingCapital as string) || DEFAULT_FPTM_CONFIG.startingCapital;
  const ladder = buildDoubleLadder(startingCapital, 14);
  res.json({ ladder });
});

export default router;
