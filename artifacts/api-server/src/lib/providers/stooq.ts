/**
 * Stooq provider — free daily OHLCV history, no API key, and (unlike Yahoo)
 * not blocked for datacenter/cloud egress IPs like Render's. Used as the
 * fallback when both Yahoo chart hosts fail, so the screener, charts and
 * sector pages keep working in production.
 */
import axios from "axios";
import type { YahooQuoteResult } from "./yahoo";

// Trading-day equivalents for the ranges the app requests (+small buffer so
// indicator warm-up periods like EMA200 still have data on shorter ranges).
const RANGE_DAYS: Record<string, number> = {
  "1mo": 30,
  "3mo": 80,
  "6mo": 150,
  "1y": 280,
  "2y": 540,
};

function stooqSymbol(ticker: string): string {
  // Stooq lists US equities as "<symbol>.us"; class shares use dashes (BRK.B
  // → brk-b.us).
  return `${ticker.trim().toLowerCase().replace(/\./g, "-")}.us`;
}

export async function fetchStooqChart(
  ticker: string,
  range = "1y",
): Promise<YahooQuoteResult | null> {
  try {
    const url = `https://stooq.com/q/d/l/?s=${stooqSymbol(ticker)}&i=d`;
    const { data } = await axios.get<string>(url, {
      timeout: 15000,
      responseType: "text",
      transformResponse: [(d) => d],
    });

    // CSV: Date,Open,High,Low,Close,Volume — or "No data" / an HTML error
    // page when the symbol is unknown or the daily hit limit was exceeded.
    if (typeof data !== "string" || !data.startsWith("Date,")) return null;

    const lines = data.trim().split("\n").slice(1);
    const keep = RANGE_DAYS[range] ?? 280;
    const rows = lines.slice(-keep);

    const out: YahooQuoteResult = {
      closes: [],
      highs: [],
      lows: [],
      opens: [],
      volumes: [],
      timestamps: [],
    };

    for (const line of rows) {
      const [date, open, high, low, close, volume] = line.split(",");
      const c = parseFloat(close);
      if (!date || Number.isNaN(c)) continue;
      out.timestamps.push(Math.floor(Date.parse(`${date}T00:00:00Z`) / 1000));
      out.opens.push(parseFloat(open));
      out.highs.push(parseFloat(high));
      out.lows.push(parseFloat(low));
      out.closes.push(c);
      out.volumes.push(parseFloat(volume) || 0);
    }

    return out.closes.length >= 2 ? out : null;
  } catch {
    return null;
  }
}
