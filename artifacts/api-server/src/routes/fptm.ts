import { Router } from "express";
import { scanFullMarket } from "../lib/providers/fullmarket";
import { runScan, DEFAULT_CONFIG } from "../lib/scanner";
import type { TenantProviderKeys } from "../lib/providers";
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

    // Try full market data, fall back to per-ticker screener
    let market = await scanFullMarket();

    if (!market) {
      console.warn("[FPTM] Full market scan unavailable - using fallback screener with S&P 500 subset");
      // Fallback: use common tech stocks as baseline
      const fallbackTickers = [
        "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "BRK.B", "JNJ", "V",
        "WMT", "JPM", "PG", "MA", "COST", "MCD", "BA", "NFLX", "INTC", "AMD",
      ];
      const fallbackResult = await runScan(fallbackTickers, DEFAULT_CONFIG, false, {} as TenantProviderKeys);
      if (!fallbackResult?.candidates || fallbackResult.candidates.length === 0) {
        res.status(200).json({
          error: "No market data available",
          candidates: [],
          total: 0,
          scanned: 0,
          config,
          ladder: buildDoubleLadder(config.startingCapital, 14),
          cachedAt: new Date().toISOString(),
        });
        return;
      }
      // Convert screener records to fullmarket format
      market = {
        records: fallbackResult.candidates.map((r: any) => ({
          ticker: r.ticker,
          verdict: "GO",
          score: r.score || 0.5,
          reason: "FALLBACK_SCREENER",
          technical: r.technical,
        })),
        cachedAt: new Date(),
      };
    }

    console.log(`[FPTM] Scanning ${market.records.length} records`);

    // Convert to snapshots
    const snapshots = market.records
      .map((r: any) => convertToSnapshot(r))
      .filter((s) => s.price > 0);

    console.log(`[FPTM] ${snapshots.length} snapshots with valid price`);

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

    console.log(`[FPTM] ${candidates.length} candidates passed screening`);

    res.json({
      candidates,
      total: candidates.length,
      scanned: snapshots.length,
      config,
      ladder: buildDoubleLadder(config.startingCapital, 14),
      cachedAt: market.cachedAt.toISOString(),
    });
  } catch (error) {
    console.error("[FPTM] Scan error:", error);
    res.status(500).json({ error: "Scan failed", candidates: [], total: 0, scanned: 0 });
  }
});

// GET /api/fptm/ladder - Get the 14-double ladder
router.get("/fptm/ladder", (req, res): void => {
  const startingCapital = parseFloat(req.query.startingCapital as string) || DEFAULT_FPTM_CONFIG.startingCapital;
  const ladder = buildDoubleLadder(startingCapital, 14);
  res.json({ ladder });
});

export default router;
