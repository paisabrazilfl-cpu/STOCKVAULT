import { describe, it, expect } from "vitest";
import {
  ema, sma, rsi, macd, macd3Month, atr, rvol, adx,
  stochastic, fullStochastic, isBreakout, isBreakout52w,
} from "../scanner";

const flat = (n: number, v: number) => Array(n).fill(v);
const ramp = (n: number, start = 1, step = 1) =>
  Array.from({ length: n }, (_, i) => start + i * step);

describe("ema", () => {
  it("returns 0 for empty input", () => expect(ema([], 10)).toBe(0));
  it("equals the constant for a flat series", () => {
    expect(ema(flat(50, 42), 10)).toBeCloseTo(42, 10);
  });
  it("tracks below the last price on a rising series (lag)", () => {
    const prices = ramp(50);
    const e = ema(prices, 10);
    expect(e).toBeLessThan(prices[prices.length - 1]);
    expect(e).toBeGreaterThan(prices[0]);
  });
  it("shorter period hugs price more closely than longer period", () => {
    const prices = ramp(60);
    expect(ema(prices, 5)).toBeGreaterThan(ema(prices, 30));
  });
});

describe("sma", () => {
  it("returns 0 for empty input", () => expect(sma([], 20)).toBe(0));
  it("computes the mean of the last `period` values", () => {
    // last 3 of [1,2,3,4,5] = [3,4,5] → mean 4
    expect(sma([1, 2, 3, 4, 5], 3)).toBe(4);
  });
  it("uses all values when fewer than period", () => {
    expect(sma([2, 4], 20)).toBe(3);
  });
});

describe("rsi", () => {
  it("returns neutral 50 with insufficient data", () => {
    expect(rsi(flat(5, 10))).toBe(50);
  });
  it("returns 100 when every move is a gain", () => {
    expect(rsi(ramp(30))).toBe(100);
  });
  it("returns ~0 when every move is a loss", () => {
    expect(rsi(ramp(30, 100, -1))).toBeCloseTo(0, 5);
  });
  it("returns 50 for perfectly alternating equal gains/losses", () => {
    const prices: number[] = [];
    for (let i = 0; i < 30; i++) prices.push(i % 2 === 0 ? 10 : 11);
    expect(rsi(prices)).toBeCloseTo(50, 5);
  });
  it("stays within [0, 100]", () => {
    const noisy = Array.from({ length: 60 }, (_, i) => 50 + Math.sin(i) * 7 + (i % 3));
    const v = rsi(noisy);
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThanOrEqual(100);
  });
});

describe("macd / macd3Month", () => {
  it("macd line is positive in an uptrend (fast EMA > slow EMA)", () => {
    const { macd: line } = macd(ramp(80));
    expect(line).toBeGreaterThan(0);
  });
  it("macd line is negative in a downtrend", () => {
    const { macd: line } = macd(ramp(80, 200, -1));
    expect(line).toBeLessThan(0);
  });
  it("hist = macd - signal", () => {
    const r = macd(ramp(80));
    expect(r.hist).toBeCloseTo(r.macd - r.signal, 10);
  });
  it("macd3Month returns zeros when under 27 bars", () => {
    expect(macd3Month(ramp(20))).toEqual({ macd: 0, signal: 0, hist: 0 });
  });
  it("macd3Month only considers the last 65 bars", () => {
    const longSeries = [...flat(200, 5), ...ramp(65, 5, 1)];
    const shortSeries = ramp(65, 5, 1);
    expect(macd3Month(longSeries).macd).toBeCloseTo(macd3Month(shortSeries).macd, 10);
  });
});

describe("atr", () => {
  it("computes mean true range for simple bars", () => {
    // 3 bars, each H-L = 2, no gaps → TR = 2 for each of the 2 ranges
    const highs = [11, 11, 11];
    const lows = [9, 9, 9];
    const closes = [10, 10, 10];
    expect(atr(highs, lows, closes, 14)).toBe(2);
  });
  it("accounts for gaps via |high - prevClose|", () => {
    // bar2 gaps up: high 21, low 20, prevClose 10 → TR = 11
    expect(atr([11, 21], [9, 20], [10, 20.5], 14)).toBe(11);
  });
});

describe("rvol", () => {
  it("returns 1 with insufficient data", () => expect(rvol([100])).toBe(1));
  it("is 2 when the latest volume doubles the trailing average", () => {
    const vols = [...flat(20, 100), 200];
    expect(rvol(vols, 20)).toBeCloseTo(2, 10);
  });
  it("is ~1 for steady volume", () => {
    expect(rvol(flat(30, 500), 20)).toBeCloseTo(1, 10);
  });
});

describe("adx", () => {
  it("returns default 20 with insufficient data", () => {
    expect(adx([1, 2], [0, 1], [1, 1.5], 14)).toBe(20);
  });
  it("is high (>50) in a clean one-directional trend", () => {
    const n = 60;
    const highs = ramp(n, 11);
    const lows = ramp(n, 9);
    const closes = ramp(n, 10);
    expect(adx(highs, lows, closes)).toBeGreaterThan(50);
  });
  it("is low for a perfectly flat market", () => {
    // flat → no directional movement; guard path returns 20
    expect(adx(flat(60, 11), flat(60, 9), flat(60, 10))).toBeLessThanOrEqual(20);
  });
});

describe("stochastic", () => {
  it("returns neutral 50/50 with insufficient data", () => {
    expect(stochastic([1], [0], [0.5])).toEqual({ k: 50, d: 50 });
  });
  it("%K = 100 when close sits at the period high", () => {
    const n = 20;
    const highs = ramp(n, 11);
    const lows = ramp(n, 9);
    const closes = highs.slice(); // close == high
    expect(stochastic(highs, lows, closes).k).toBeCloseTo(100, 5);
  });
  it("%K = 0 when close sits at the period low", () => {
    const n = 20;
    const highs = flat(n, 11);
    const lows = flat(n, 9);
    const closes = flat(n, 9); // close pinned to the window low
    expect(stochastic(highs, lows, closes).k).toBeCloseTo(0, 5);
  });
  it("k and d stay within [0, 100]", () => {
    const n = 40;
    const closes = Array.from({ length: n }, (_, i) => 10 + Math.sin(i / 3) * 2);
    const highs = closes.map((c) => c + 0.5);
    const lows = closes.map((c) => c - 0.5);
    const { k, d } = stochastic(highs, lows, closes);
    for (const v of [k, d]) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });
});

describe("fullStochastic", () => {
  it("returns neutral with insufficient data", () => {
    expect(fullStochastic([1], [0], [0.5])).toEqual({ fastK: 50, slowK: 50, slowD: 50 });
  });
  it("slowK is a smoothed version (≤ fastK in a fresh breakout)", () => {
    // mostly mid-range, then a hard breakout on the final bar:
    // fast %K jumps to 100 instantly; slow %K (3-bar SMA) lags below it
    const n = 30;
    const highs = flat(n, 11);
    const lows = flat(n, 9);
    const closes = flat(n, 10);
    highs[n - 1] = 12;
    closes[n - 1] = 12;
    const { fastK, slowK } = fullStochastic(highs, lows, closes);
    expect(fastK).toBeCloseTo(100, 5);
    expect(slowK).toBeLessThan(fastK);
  });
});

describe("breakouts", () => {
  it("isBreakout true when last close exceeds prior 20-bar max", () => {
    expect(isBreakout([...flat(25, 10), 11])).toBe(true);
  });
  it("isBreakout false inside the range", () => {
    expect(isBreakout([...flat(25, 10), 9.5])).toBe(false);
  });
  it("isBreakout false with insufficient data", () => {
    expect(isBreakout(flat(10, 10))).toBe(false);
  });
  it("isBreakout52w true within 3% of the 52-week high", () => {
    const closes = [...flat(100, 10), 20, ...flat(50, 15), 19.5]; // 19.5 ≥ 20*0.97
    expect(isBreakout52w(closes)).toBe(true);
  });
  it("isBreakout52w false when well below the high", () => {
    const closes = [...flat(100, 10), 20, ...flat(50, 15), 15];
    expect(isBreakout52w(closes)).toBe(false);
  });
});
