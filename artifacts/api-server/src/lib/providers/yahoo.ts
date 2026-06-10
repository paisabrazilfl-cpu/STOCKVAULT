/**
 * Yahoo Finance provider — free baseline, no API key required.
 * Handles: OHLCV history, fundamentals (key stats + earnings calendar).
 */
import axios from "axios";

const YF_HEADERS = { "User-Agent": "Mozilla/5.0 (compatible; MotionScanner/3.0)" };

export interface YahooQuoteResult {
  closes: number[];
  highs: number[];
  lows: number[];
  opens: number[];
  volumes: number[];
  timestamps: number[];
}

export async function fetchYahooChart(ticker: string, range = "1y"): Promise<YahooQuoteResult | null> {
  // Yahoo throttles single IPs (esp. datacenter/cloud egress like Render) and
  // occasionally 401/429s one host while the other still serves. Try both
  // query hosts before giving up so a transient block on one doesn't take the
  // whole feature down.
  const hosts = ["query1.finance.yahoo.com", "query2.finance.yahoo.com"];
  for (const host of hosts) {
    try {
      const url = `https://${host}/v8/finance/chart/${ticker}?interval=1d&range=${range}&includePrePost=false`;
      const { data } = await axios.get(url, { timeout: 15000, headers: YF_HEADERS });
      const result = data?.chart?.result?.[0];
      if (!result) continue;
      const q = result.indicators?.quote?.[0] ?? {};
      const notNull = (arr: (number | null)[]): number[] => (arr ?? []).filter((v) => v != null) as number[];
      return {
        closes: notNull(q.close ?? []),
        highs: notNull(q.high ?? []),
        lows: notNull(q.low ?? []),
        opens: notNull(q.open ?? []),
        volumes: notNull(q.volume ?? []),
        timestamps: (result.timestamp ?? []) as number[],
      };
    } catch {
      // try next host
    }
  }
  return null;
}

export interface YahooFundamentals {
  daysToEarnings: number | null;
  shortInterest: number | null;
  floatShares: number | null;
  marketCap: number | null;
  peRatio: number | null;
  beta: number | null;
  sector: string | null;
  industry: string | null;
}

export async function fetchYahooFundamentals(ticker: string): Promise<YahooFundamentals | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${ticker}?modules=defaultKeyStatistics,calendarEvents,assetProfile,summaryDetail`;
    const { data } = await axios.get(url, { timeout: 12000, headers: YF_HEADERS });
    const res = data?.quoteSummary?.result?.[0] ?? {};
    const ks = res.defaultKeyStatistics ?? {};
    const cal = res.calendarEvents ?? {};
    const profile = res.assetProfile ?? {};
    const summary = res.summaryDetail ?? {};

    const earningsDate = cal?.earnings?.earningsDate?.[0]?.raw;
    let daysToEarnings: number | null = null;
    if (earningsDate) {
      daysToEarnings = Math.round((earningsDate * 1000 - Date.now()) / 86400000);
    }

    return {
      daysToEarnings,
      shortInterest: ks.shortPercentOfFloat?.raw ?? null,
      floatShares: ks.floatShares?.raw ?? null,
      marketCap: summary.marketCap?.raw ?? null,
      peRatio: summary.trailingPE?.raw ?? null,
      beta: summary.beta?.raw ?? null,
      sector: profile.sector ?? null,
      industry: profile.industry ?? null,
    };
  } catch { return null; }
}

export async function fetchSpyReturn(days = 5): Promise<number> {
  try {
    const chart = await fetchYahooChart("SPY", "1mo");
    if (!chart || chart.closes.length < 2) return 0;
    const closes = chart.closes;
    const lookback = Math.min(days, closes.length - 1);
    const prev = closes[closes.length - 1 - lookback];
    return (closes[closes.length - 1] - prev) / prev;
  } catch { return 0; }
}

export interface YahooTickerHit {
  ticker: string;
  name: string;
  market: string;
  primaryExchange: string | null;
  type: string | null;
  currency: string | null;
  active: boolean;
}

/**
 * Free ticker search via Yahoo Finance — the zero-key fallback for
 * /api/tickers/search, so symbol lookup works out of the box without a
 * Polygon/Massive key. Tries both query hosts (same throttling caveat as
 * fetchYahooChart). Returns [] on any failure — callers degrade gracefully.
 */
export async function searchYahooTickers(query: string, limit = 20): Promise<YahooTickerHit[]> {
  const q = query.trim();
  if (!q) return [];
  const hosts = ["query1.finance.yahoo.com", "query2.finance.yahoo.com"];
  for (const host of hosts) {
    try {
      const { data } = await axios.get(`https://${host}/v1/finance/search`, {
        timeout: 8000,
        headers: YF_HEADERS,
        params: { q, quotesCount: Math.min(Math.max(limit, 1), 50), newsCount: 0, listsCount: 0 },
      });
      const quotes = (data?.quotes ?? []) as any[];
      return quotes
        .filter((r) => r?.symbol && (r.quoteType === "EQUITY" || r.quoteType === "ETF"))
        .map((r) => ({
          ticker: String(r.symbol),
          name: String(r.longname ?? r.shortname ?? r.symbol),
          market: "stocks",
          primaryExchange: r.exchDisp ?? r.exchange ?? null,
          type: r.quoteType === "ETF" ? "ETF" : "CS",
          currency: null,
          active: true,
        }));
    } catch {
      // try the next host
    }
  }
  return [];
}
