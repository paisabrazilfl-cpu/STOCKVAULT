/**
 * FPTM: 14-Double Momentum Strategy
 * Finds high-momentum penny stocks with strict risk controls
 * Compounds $100 → $1,600,000 in 14 consecutive 100% gains
 */

export type StockSnapshot = {
  symbol: string;
  price: number;
  high52w: number;
  low52w: number;
  monthlyChangePct: number;
  marketCap: number;
  avgVolume: number;
  currentVolume: number;
  floatShares?: number;
  hasCatalyst?: boolean;
  dilutionRisk?: "low" | "medium" | "high" | "unknown";
  sector?: string;
};

export type StrategyConfig = {
  startingCapital: number;
  targetCapital: number;
  minPrice: number;
  maxPrice: number;
  minMoveFrom52wLowPct: number;
  minMonthlyChangePct: number;
  maxDistanceFrom52wHighPct: number;
  minAvgVolume: number;
  minRelativeVolume: number;
  minMarketCap: number;
  maxMarketCap: number;
  maxFloatShares?: number;
  requireCatalyst: boolean;
  allowUnknownDilution: boolean;
  maxRiskPctPerTrade: number;
  stopLossPct: number;
  profitTargetPct: number;
};

export const DEFAULT_FPTM_CONFIG: StrategyConfig = {
  startingCapital: 100,
  targetCapital: 1_000_000,
  minPrice: 1,
  maxPrice: 10,
  minMoveFrom52wLowPct: 100,
  minMonthlyChangePct: 20,
  maxDistanceFrom52wHighPct: 10,
  minAvgVolume: 500_000,
  minRelativeVolume: 2,
  minMarketCap: 25_000_000,
  maxMarketCap: 2_000_000_000,
  maxFloatShares: 100_000_000,
  requireCatalyst: false,
  allowUnknownDilution: true,
  maxRiskPctPerTrade: 0.25,
  stopLossPct: 25,
  profitTargetPct: 100,
};

export type CandidateResult = {
  symbol: string;
  passed: boolean;
  score: number;
  reasons: string[];
  warnings: string[];
  metrics: {
    moveFrom52wLowPct: number;
    distanceFrom52wHighPct: number;
    relativeVolume: number;
  };
};

export function analyzeCandidate(
  stock: StockSnapshot,
  config: StrategyConfig = DEFAULT_FPTM_CONFIG
): CandidateResult {
  const reasons: string[] = [];
  const warnings: string[] = [];
  let score = 0;

  const moveFrom52wLowPct =
    stock.low52w > 0 ? ((stock.price - stock.low52w) / stock.low52w) * 100 : 0;

  const distanceFrom52wHighPct =
    stock.high52w > 0 ? ((stock.high52w - stock.price) / stock.high52w) * 100 : 100;

  const relativeVolume =
    stock.avgVolume > 0 ? stock.currentVolume / stock.avgVolume : 0;

  if (stock.price >= config.minPrice && stock.price <= config.maxPrice) {
    score += 10;
    reasons.push(`Price: $${stock.price.toFixed(2)}`);
  } else {
    warnings.push(`Price outside $${config.minPrice}-$${config.maxPrice}`);
  }

  if (moveFrom52wLowPct >= config.minMoveFrom52wLowPct) {
    score += 20;
    reasons.push(`2× from low: +${moveFrom52wLowPct.toFixed(0)}%`);
  } else {
    warnings.push(`Only +${moveFrom52wLowPct.toFixed(0)}% from 52w low`);
  }

  if (stock.monthlyChangePct >= config.minMonthlyChangePct) {
    score += 20;
    reasons.push(`MoM: +${stock.monthlyChangePct.toFixed(0)}%`);
  } else {
    warnings.push(`MoM: only +${stock.monthlyChangePct.toFixed(0)}%`);
  }

  if (distanceFrom52wHighPct <= config.maxDistanceFrom52wHighPct) {
    score += 15;
    reasons.push(`Near high: ${distanceFrom52wHighPct.toFixed(1)}% away`);
  } else {
    warnings.push(`Far from high: ${distanceFrom52wHighPct.toFixed(1)}% away`);
  }

  if (stock.avgVolume >= config.minAvgVolume) {
    score += 10;
    reasons.push(`Volume: ${(stock.avgVolume / 1_000_000).toFixed(1)}M`);
  } else {
    warnings.push(`Low volume: ${(stock.avgVolume / 1_000_000).toFixed(1)}M`);
  }

  if (relativeVolume >= config.minRelativeVolume) {
    score += 15;
    reasons.push(`Relative vol: ${relativeVolume.toFixed(1)}×`);
  } else {
    warnings.push(`Relative vol: ${relativeVolume.toFixed(1)}×`);
  }

  if (
    stock.marketCap >= config.minMarketCap &&
    stock.marketCap <= config.maxMarketCap
  ) {
    score += 10;
    reasons.push(`Cap: $${(stock.marketCap / 1_000_000).toFixed(0)}M`);
  } else {
    warnings.push(`Cap out of range`);
  }

  if (config.maxFloatShares && stock.floatShares !== undefined) {
    if (stock.floatShares <= config.maxFloatShares) {
      score += 10;
      reasons.push(`Float: ${(stock.floatShares / 1_000_000).toFixed(0)}M`);
    } else {
      warnings.push(`Float too large`);
    }
  }

  if (config.requireCatalyst) {
    if (stock.hasCatalyst) {
      score += 15;
      reasons.push("✓ Catalyst");
    } else {
      warnings.push("✗ No catalyst");
    }
  }

  if (stock.dilutionRisk === "low") {
    score += 15;
    reasons.push("✓ Low dilution risk");
  } else if (stock.dilutionRisk === "unknown" && config.allowUnknownDilution) {
    warnings.push("? Unknown dilution");
  } else {
    warnings.push(`✗ ${stock.dilutionRisk ?? "unknown"} dilution risk`);
  }

  const hardPass =
    stock.price >= config.minPrice &&
    stock.price <= config.maxPrice &&
    moveFrom52wLowPct >= config.minMoveFrom52wLowPct &&
    stock.monthlyChangePct >= config.minMonthlyChangePct &&
    distanceFrom52wHighPct <= config.maxDistanceFrom52wHighPct &&
    stock.avgVolume >= config.minAvgVolume &&
    relativeVolume >= config.minRelativeVolume &&
    stock.marketCap >= config.minMarketCap &&
    stock.marketCap <= config.maxMarketCap &&
    (!config.requireCatalyst || stock.hasCatalyst === true) &&
    (
      stock.dilutionRisk === "low" ||
      (stock.dilutionRisk === "unknown" && config.allowUnknownDilution)
    );

  return {
    symbol: stock.symbol,
    passed: hardPass,
    score,
    reasons,
    warnings,
    metrics: {
      moveFrom52wLowPct,
      distanceFrom52wHighPct,
      relativeVolume,
    },
  };
}

export function scanMarket(
  stocks: StockSnapshot[],
  config: StrategyConfig = DEFAULT_FPTM_CONFIG
): CandidateResult[] {
  return stocks
    .map((stock) => analyzeCandidate(stock, config))
    .filter((result) => result.passed)
    .sort((a, b) => b.score - a.score);
}

export type DoubleStep = {
  step: number;
  capital: number;
};

export function buildDoubleLadder(
  startingCapital = 100,
  steps = 14
): DoubleStep[] {
  const ladder: DoubleStep[] = [];
  for (let i = 0; i <= steps; i++) {
    ladder.push({
      step: i,
      capital: startingCapital * Math.pow(2, i),
    });
  }
  return ladder;
}

export function doublesNeeded(
  startingCapital: number,
  targetCapital: number
): number {
  return Math.ceil(Math.log(targetCapital / startingCapital) / Math.log(2));
}

export type TradePlan = {
  symbol: string;
  entryPrice: number;
  stopLossPrice: number;
  targetPrice: number;
  accountCapital: number;
  maxPositionValue: number;
  shares: number;
  maxDollarLoss: number;
};

export function createTradePlan(
  stock: StockSnapshot,
  accountCapital: number,
  config: StrategyConfig = DEFAULT_FPTM_CONFIG
): TradePlan {
  const entryPrice = stock.price;
  const stopLossPrice = entryPrice * (1 - config.stopLossPct / 100);
  const targetPrice = entryPrice * (1 + config.profitTargetPct / 100);
  const maxPositionValue = accountCapital * config.maxRiskPctPerTrade;
  const shares = Math.floor(maxPositionValue / entryPrice);
  const maxDollarLoss = shares * (entryPrice - stopLossPrice);

  return {
    symbol: stock.symbol,
    entryPrice,
    stopLossPrice,
    targetPrice,
    accountCapital,
    maxPositionValue,
    shares,
    maxDollarLoss,
  };
}

export type BotDecision =
  | {
      action: "BUY_CANDIDATE";
      candidate: CandidateResult;
      tradePlan: TradePlan;
    }
  | {
      action: "NO_TRADE";
      reason: string;
      topCandidates: CandidateResult[];
    };

export function decideNextTrade(
  stocks: StockSnapshot[],
  accountCapital: number,
  config: StrategyConfig = DEFAULT_FPTM_CONFIG
): BotDecision {
  const candidates = scanMarket(stocks, config);

  if (candidates.length === 0) {
    return {
      action: "NO_TRADE",
      reason: "No candidates passed the 14-doubles screener.",
      topCandidates: [],
    };
  }

  const best = candidates[0];
  const matchingStock = stocks.find((s) => s.symbol === best.symbol);

  if (!matchingStock) {
    return {
      action: "NO_TRADE",
      reason: "Best candidate stock data unavailable.",
      topCandidates: candidates.slice(0, 10),
    };
  }

  const tradePlan = createTradePlan(matchingStock, accountCapital, config);

  if (tradePlan.shares <= 0) {
    return {
      action: "NO_TRADE",
      reason: "Account too small for minimum position.",
      topCandidates: candidates.slice(0, 10),
    };
  }

  return {
    action: "BUY_CANDIDATE",
    candidate: best,
    tradePlan,
  };
}
