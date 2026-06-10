import { describe, it, expect } from "vitest";
import {
  qualify, compositeScore, monteCarlo, DEFAULT_CONFIG,
  type TechData, type FundData, type FlowData,
} from "../scanner";

// ── Fixtures ─────────────────────────────────────────────────────────────────
function tech(overrides: Partial<TechData> = {}): TechData {
  return {
    ok: true,
    price: 50, close: 50, high: 51, low: 49, open: 49.5,
    volume: 2_000_000, rvol: 2.0, atr: 1.5, atr_pct: 0.03,
    ema9: 49, ema10: 48.5, ema21: 48, ema50: 47, ema200: 45, sma20: 48,
    ema_stack_ok: true, rsi: 60,
    macd: 0.5, macdSignal: 0.1, macdHist: 0.4,
    stochK: 70, stochD: 65, stochSlowK: 68, stochSlowD: 64,
    macd3m: 0.3, macd3mSignal: 0.06, macd3mHist: 0.24,
    adx: 30, breakout: true, breakout52w: false,
    dollar_volume: 100_000_000, change: 1.2, changePct: 2.4,
    high52w: 60, low52w: 20, range52w: 3,
    ...overrides,
  } as TechData;
}

function fund(overrides: Partial<FundData> = {}): FundData {
  return {
    ok: true, days_to_earnings: 30, eps_surprise_pct: 5,
    short_interest: 0.05, market_cap: 5_000_000_000,
    ...overrides,
  } as FundData;
}

function flow(overrides: Partial<FlowData> = {}): FlowData {
  return {
    ok: true, dollar_volume: 50_000_000, rel_strength_spy: 0.01,
    volumeSpike: false,
    ...overrides,
  } as FlowData;
}

const cfg = () => JSON.parse(JSON.stringify(DEFAULT_CONFIG)) as Record<string, unknown>;

// ── qualify: tri-state gates ─────────────────────────────────────────────────
describe("qualify — ABORT gates", () => {
  it("ABORTs when technicals are unavailable", () => {
    const r = qualify({ ok: false } as TechData, fund(), flow(), cfg());
    expect(r).toEqual({ state: "ABORT", reason: "NO_TECHNICAL_DATA" });
  });
  it("ABORTs below the price floor", () => {
    const r = qualify(tech({ close: 0.5 }), fund(), flow(), cfg());
    expect(r.state).toBe("ABORT");
    expect(r.reason).toBe("PRICE_BELOW_FLOOR");
  });
  it("ABORTs above the price ceiling", () => {
    const r = qualify(tech({ close: 5000 }), fund(), flow(), cfg());
    expect(r.reason).toBe("PRICE_ABOVE_CEILING");
  });
  it("ABORTs on thin dollar volume", () => {
    const r = qualify(tech(), fund(), flow({ dollar_volume: 100_000 }), cfg());
    expect(r.reason).toBe("DOLLAR_VOL_TOO_LOW");
  });
  it("ABORTs inside the earnings blackout window", () => {
    const r = qualify(tech(), fund({ days_to_earnings: 1 }), flow(), cfg());
    expect(r.state).toBe("ABORT");
    expect(r.reason).toMatch(/^EARNINGS_BLACKOUT_/);
  });
  it("does NOT abort when earnings are past (negative days)", () => {
    const r = qualify(tech(), fund({ days_to_earnings: -3 }), flow(), cfg());
    expect(r.state).toBe("GO");
  });
});

describe("qualify — HOLD gates", () => {
  it("HOLDs on low relative volume", () => {
    const r = qualify(tech({ rvol: 0.5 }), fund(), flow(), cfg());
    expect(r.state).toBe("HOLD");
    expect(r.reason).toMatch(/^RVOL_LOW_/);
  });
  it("HOLDs when ATR%% is below minimum", () => {
    const r = qualify(tech({ atr_pct: 0.001 }), fund(), flow(), cfg());
    expect(r.reason).toBe("ATR_BELOW_MIN");
  });
  it("HOLDs on RSI outside the band", () => {
    expect(qualify(tech({ rsi: 95 }), fund(), flow(), cfg()).reason).toMatch(/^RSI_OUT_OF_BAND_/);
    expect(qualify(tech({ rsi: 10 }), fund(), flow(), cfg()).reason).toMatch(/^RSI_OUT_OF_BAND_/);
  });
  it("EMA-stack gate only fires when required by config", () => {
    const c = cfg();
    expect(qualify(tech({ ema_stack_ok: false }), fund(), flow(), c).state).toBe("GO");
    (c.technical as any).ema_stack_required = true;
    expect(qualify(tech({ ema_stack_ok: false }), fund(), flow(), c).reason).toBe("EMA_STACK_BROKEN");
  });
  it("EMA10 / SMA20 filters fire only when enabled", () => {
    const c = cfg();
    (c.technical as any).ema10_filter = true;
    expect(qualify(tech({ close: 40, ema10: 48 }), fund(), flow(), c).reason).toMatch(/^BELOW_EMA10_/);
    const c2 = cfg();
    (c2.technical as any).sma20_filter = true;
    expect(qualify(tech({ close: 40, sma20: 48 }), fund(), flow(), c2).reason).toMatch(/^BELOW_SMA20_/);
  });
  it("stochastic filter HOLDs at extremes when enabled", () => {
    const c = cfg();
    (c.technical as any).stoch_filter = true;
    expect(qualify(tech({ stochSlowK: 10 }), fund(), flow(), c).reason).toMatch(/^STOCH_OVERSOLD_/);
    expect(qualify(tech({ stochSlowK: 95 }), fund(), flow(), c).reason).toMatch(/^STOCH_OVERBOUGHT_/);
  });
  it("3-month MACD gates fire only when enabled", () => {
    const c = cfg();
    (c.technical as any).macd3m_filter = true;
    (c.technical as any).macd3m_require_above_zero = true;
    expect(qualify(tech({ macd3m: -0.2 }), fund(), flow(), c).reason).toMatch(/^MACD3M_BELOW_ZERO_/);
  });
});

describe("qualify — GO path", () => {
  it("returns GO when every gate passes", () => {
    expect(qualify(tech(), fund(), flow(), cfg())).toEqual({
      state: "GO",
      reason: "ALL_GATES_PASS",
    });
  });
});

// ── compositeScore ───────────────────────────────────────────────────────────
describe("compositeScore", () => {
  it("is bounded in [0, 1]", () => {
    const s = compositeScore(tech(), flow(), fund(), { expected_R: 2 }, null, null, cfg());
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(1);
  });
  it("scores a strong setup higher than a weak one", () => {
    const strong = compositeScore(
      tech({ rvol: 4, atr_pct: 0.08, ema_stack_ok: true, breakout: true, adx: 50 }),
      flow({ dollar_volume: 60_000_000, rel_strength_spy: 0.05, volumeSpike: true }),
      fund({ eps_surprise_pct: 25, short_interest: 0.25 }),
      { expected_R: 1.5 }, null, null, cfg(),
    );
    const weak = compositeScore(
      tech({ rvol: 0.5, atr_pct: 0.005, ema_stack_ok: false, breakout: false, adx: 10 }),
      flow({ dollar_volume: 500_000, rel_strength_spy: -0.05 }),
      fund({ eps_surprise_pct: -10, short_interest: 0, market_cap: 100_000_000 }),
      { expected_R: 0 }, null, null, cfg(),
    );
    expect(strong).toBeGreaterThan(weak);
  });
  it("handles missing data blocks without throwing", () => {
    const s = compositeScore(
      { ok: false } as TechData, { ok: false } as FlowData, { ok: false } as FundData,
      null, null, null, cfg(),
    );
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(1);
  });
  it("survives degenerate all-zero weights (no divide-by-zero)", () => {
    const c = cfg();
    c.scoring_weights = { technical: 0, flow: 0, fundamental: 0, monte_carlo: 0, options: 0, sentiment: 0, sector: 0 };
    const s = compositeScore(tech(), flow(), fund(), null, null, null, c);
    expect(Number.isFinite(s)).toBe(true);
  });
});

// ── monteCarlo ───────────────────────────────────────────────────────────────
describe("monteCarlo", () => {
  it("produces a coherent trade plan: stop < entry < target", () => {
    const r = monteCarlo(tech(), cfg());
    expect(r.ok).toBe(true);
    expect(r.stop_price as number).toBeLessThan(r.entry_price as number);
    expect(r.target_price as number).toBeGreaterThan(r.entry_price as number);
  });
  it("win_rate and percentiles are sane", () => {
    const r = monteCarlo(tech(), cfg());
    expect(r.win_rate as number).toBeGreaterThanOrEqual(0);
    expect(r.win_rate as number).toBeLessThanOrEqual(1);
    expect(r.p10 as number).toBeLessThanOrEqual(r.p50 as number);
    expect(r.p50 as number).toBeLessThanOrEqual(r.p90 as number);
  });
  it("caps simulations at 500 even if config asks for more", () => {
    const c = cfg();
    (c.monte_carlo as any).simulations = 50_000;
    expect(monteCarlo(tech(), c).simulations).toBe(500);
  });
  it("applies the volatility floor when ATR%% is zero (no degenerate stop)", () => {
    const r = monteCarlo(tech({ atr_pct: 0 }), cfg());
    expect(r.stop_price as number).toBeLessThan(r.entry_price as number);
    expect(Number.isFinite(r.expected_R as number)).toBe(true);
  });
});
