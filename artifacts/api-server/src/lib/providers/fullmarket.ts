/**
 * Full-market universe + lightweight bulk screen.
 *
 * Symbol directory: NASDAQ Trader symbol files (nasdaqlisted.txt +
 * otherlisted.txt) — every NASDAQ/NYSE/AMEX listing, free, no API key.
 * After filtering out ETFs, test issues, warrants/units/preferreds this
 * yields ~5-7k common stocks.
 *
 * Price history: Yahoo's "spark" endpoint returns daily closes for many
 * symbols per request, so the whole market screens in a few hundred HTTP
 * calls instead of 6,000 individual chart fetches.
 */
import axios from "axios";

const YF_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept: "application/json",
};

// ── Symbol directory (24h cache) ──────────────────────────────────────────────

let symbolCache: { symbols: string[]; fetchedAt: number } | null = null;
const SYMBOLS_TTL_MS = 24 * 60 * 60 * 1000;

// SPAC units, warrants and rights aren't screenable common stock.
const NON_COMMON_NAME = /\bwarrants?\b|\brights?\b|\bunits?\b/i;

function parseSymbolFile(text: string, symbolCol: number, etfCol: number, testCol: number): string[] {
  const out: string[] = [];
  for (const line of text.split("\n").slice(1)) {
    const cols = line.split("|");
    if (cols.length <= Math.max(symbolCol, etfCol, testCol)) continue;
    const sym = cols[symbolCol]?.trim();
    if (!sym || !/^[A-Z]{1,5}$/.test(sym)) continue; // skip preferreds/classes (., $, -)
    if (cols[etfCol]?.trim() === "Y") continue;
    if (cols[testCol]?.trim() === "Y") continue;
    if (NON_COMMON_NAME.test(cols[1] ?? "")) continue;
    out.push(sym);
  }
  return out;
}

export async function fetchFullMarketSymbols(): Promise<string[] | null> {
  if (symbolCache && Date.now() - symbolCache.fetchedAt < SYMBOLS_TTL_MS) {
    return symbolCache.symbols;
  }
  try {
    const base = "https://www.nasdaqtrader.com/dynamic/SymDir";
    const [nasdaq, other] = await Promise.all([
      axios.get(`${base}/nasdaqlisted.txt`, { timeout: 20000, responseType: "text" }),
      axios.get(`${base}/otherlisted.txt`, { timeout: 20000, responseType: "text" }),
    ]);
    // nasdaqlisted: Symbol|Security Name|Market Category|Test Issue|Financial Status|Round Lot|ETF|NextShares
    // otherlisted:  ACT Symbol|Security Name|Exchange|CQS Symbol|ETF|Round Lot|Test Issue|NASDAQ Symbol
    const symbols = [...new Set([
      ...parseSymbolFile(String(nasdaq.data), 0, 6, 3),
      ...parseSymbolFile(String(other.data), 0, 4, 6),
    ])];
    if (symbols.length < 1000) return null; // directory looks broken — caller falls back
    symbolCache = { symbols, fetchedAt: Date.now() };
    return symbols;
  } catch {
    return null;
  }
}

// ── Bulk close history via Yahoo spark ────────────────────────────────────────

interface SparkSeries {
  symbol: string;
  closes: number[];
}

async function fetchSparkChunk(symbols: string[]): Promise<SparkSeries[]> {
  const hosts = ["query1.finance.yahoo.com", "query2.finance.yahoo.com"];
  for (const host of hosts) {
    try {
      const { data } = await axios.get(`https://${host}/v8/finance/spark`, {
        timeout: 15000,
        headers: YF_HEADERS,
        params: { symbols: symbols.join(","), range: "1y", interval: "1d" },
      });
      const out: SparkSeries[] = [];
      // v8 shape: { spark: { result: [{ symbol, response: [{ indicators: { quote: [{ close: [...] }] } }] }] } }
      const results = data?.spark?.result;
      if (Array.isArray(results)) {
        for (const r of results) {
          const closes = (r?.response?.[0]?.indicators?.quote?.[0]?.close ?? [])
            .filter((v: number | null) => v != null) as number[];
          if (r?.symbol && closes.length) out.push({ symbol: String(r.symbol), closes });
        }
        return out;
      }
      // legacy map shape: { AAPL: { symbol, close: [...] }, ... }
      if (data && typeof data === "object") {
        for (const [sym, v] of Object.entries(data as Record<string, any>)) {
          const closes = (v?.close ?? []).filter((c: number | null) => c != null) as number[];
          if (closes.length) out.push({ symbol: sym, closes });
        }
        if (out.length) return out;
      }
    } catch {
      // try next host
    }
  }
  return [];
}

// ── Full-market scan (15-min cache, in-flight dedupe) ─────────────────────────

export interface FullMarketRecord {
  ticker: string;
  verdict: "GO" | "HOLD" | "ABORT";
  score: number;
  reason: string;
  technical: Record<string, unknown>;
}

let scanCache: { records: FullMarketRecord[]; cachedAt: Date } | null = null;
let scanInFlight: Promise<FullMarketRecord[] | null> | null = null;
const SCAN_TTL_MS = 15 * 60 * 1000;

// Yahoo spark rejects requests with more than 20 symbols.
const CHUNK_SIZE = 20;
const CONCURRENCY = 10;

function recordFromCloses(symbol: string, closes: number[]): FullMarketRecord | null {
  if (closes.length < 60) return null; // need enough history for 52w stats to mean anything
  const price = closes[closes.length - 1];
  if (!price || price <= 0) return null;
  const prevClose = closes[closes.length - 2] ?? price;

  const high52w = Math.max(...closes);
  const positives = closes.filter((c) => c > 0);
  const low52w = positives.length ? Math.min(...positives) : price;
  const range52w = low52w > 0 ? high52w / low52w : 0;
  const pctFromHigh52w = high52w > 0 ? price / high52w - 1 : 0;
  const monthAgo = closes[closes.length - 1 - 21];
  const mom1m = monthAgo && monthAgo > 0 ? price / monthAgo - 1 : 0;

  // Close-only score: momentum strength + proximity to the 52w high, 0..1
  const momScore = Math.max(0, Math.min(1, mom1m / 0.5));
  const nearHighScore = Math.max(0, Math.min(1, 1 + pctFromHigh52w / 0.5));
  const score = momScore * 0.5 + nearHighScore * 0.5;

  const verdict: FullMarketRecord["verdict"] =
    mom1m >= 0.05 && pctFromHigh52w >= -0.2 ? "GO" : mom1m >= 0 ? "HOLD" : "ABORT";

  return {
    ticker: symbol,
    verdict,
    score: parseFloat(score.toFixed(4)),
    reason: verdict === "GO" ? "MOMENTUM_NEAR_HIGH" : verdict === "HOLD" ? "FLAT_MOMENTUM" : "NEGATIVE_MOMENTUM",
    technical: {
      ok: true,
      price: parseFloat(price.toFixed(2)),
      close: parseFloat(price.toFixed(2)),
      high52w: parseFloat(high52w.toFixed(2)),
      low52w: parseFloat(low52w.toFixed(2)),
      range52w: parseFloat(range52w.toFixed(2)),
      pctFromHigh52w: parseFloat(pctFromHigh52w.toFixed(4)),
      mom1m: parseFloat(mom1m.toFixed(4)),
      change: parseFloat((price - prevClose).toFixed(2)),
      changePct: prevClose > 0 ? parseFloat(((price - prevClose) / prevClose).toFixed(4)) : 0,
    },
  };
}

async function doScan(): Promise<FullMarketRecord[] | null> {
  const symbols = await fetchFullMarketSymbols();
  if (!symbols) return null;

  const chunks: string[][] = [];
  for (let i = 0; i < symbols.length; i += CHUNK_SIZE) {
    chunks.push(symbols.slice(i, i + CHUNK_SIZE));
  }

  const records: FullMarketRecord[] = [];
  let failedChunks = 0;
  for (let i = 0; i < chunks.length; i += CONCURRENCY) {
    const batch = chunks.slice(i, i + CONCURRENCY);
    const settled = await Promise.allSettled(batch.map(fetchSparkChunk));
    for (const s of settled) {
      if (s.status !== "fulfilled" || s.value.length === 0) { failedChunks++; continue; }
      for (const series of s.value) {
        const rec = recordFromCloses(series.symbol, series.closes);
        if (rec) records.push(rec);
      }
    }
  }

  // If Yahoo blocked most of the scan, signal failure so the caller can fall
  // back to the per-ticker path with its Alpaca/Stooq fallbacks.
  if (records.length < 500 || failedChunks > chunks.length / 2) return null;

  records.sort((a, b) => b.score - a.score);
  return records;
}

export async function scanFullMarket(bust = false): Promise<{ records: FullMarketRecord[]; cachedAt: Date } | null> {
  if (!bust && scanCache && Date.now() - scanCache.cachedAt.getTime() < SCAN_TTL_MS) {
    return scanCache;
  }
  if (!scanInFlight) {
    scanInFlight = doScan().finally(() => { scanInFlight = null; });
  }
  const records = await scanInFlight;
  if (!records) return null;
  scanCache = { records, cachedAt: new Date() };
  return scanCache;
}
