/**
 * Alpaca Market Data provider — daily OHLCV bars via the free IEX feed.
 * Works reliably from datacenter IPs (unlike Yahoo, which blocks them), so
 * it's the preferred fallback whenever APCA_API_KEY_ID / APCA_API_SECRET_KEY
 * are configured on the server. Paper-trading keys work — the data host is
 * the same either way.
 */
import axios from "axios";
import type { YahooQuoteResult } from "./yahoo";

// Calendar days of history per requested range (+ buffer for indicator
// warm-up periods like EMA200).
const RANGE_CALENDAR_DAYS: Record<string, number> = {
  "1mo": 45,
  "3mo": 100,
  "6mo": 200,
  "1y": 380,
  "2y": 750,
};

interface AlpacaBar {
  t: string; // RFC3339 timestamp
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export function hasAlpacaDataCreds(): boolean {
  return Boolean(
    (process.env.APCA_API_KEY_ID ?? process.env.ALPACA_API_KEY_ID) &&
      (process.env.APCA_API_SECRET_KEY ?? process.env.ALPACA_API_SECRET_KEY),
  );
}

export async function fetchAlpacaChart(
  ticker: string,
  range = "1y",
): Promise<YahooQuoteResult | null> {
  const key = process.env.APCA_API_KEY_ID ?? process.env.ALPACA_API_KEY_ID;
  const secret =
    process.env.APCA_API_SECRET_KEY ?? process.env.ALPACA_API_SECRET_KEY;
  if (!key || !secret) return null;

  try {
    const days = RANGE_CALENDAR_DAYS[range] ?? 380;
    const start = new Date(Date.now() - days * 86400000).toISOString();

    const out: YahooQuoteResult = {
      closes: [],
      highs: [],
      lows: [],
      opens: [],
      volumes: [],
      timestamps: [],
    };

    let pageToken: string | undefined;
    do {
      const { data } = await axios.get(
        `https://data.alpaca.markets/v2/stocks/${encodeURIComponent(ticker)}/bars`,
        {
          timeout: 15000,
          headers: { "APCA-API-KEY-ID": key, "APCA-API-SECRET-KEY": secret },
          params: {
            timeframe: "1Day",
            start,
            limit: 10000,
            adjustment: "split",
            feed: "iex",
            ...(pageToken ? { page_token: pageToken } : {}),
          },
        },
      );

      for (const bar of (data?.bars ?? []) as AlpacaBar[]) {
        out.timestamps.push(Math.floor(Date.parse(bar.t) / 1000));
        out.opens.push(bar.o);
        out.highs.push(bar.h);
        out.lows.push(bar.l);
        out.closes.push(bar.c);
        out.volumes.push(bar.v ?? 0);
      }
      pageToken = data?.next_page_token ?? undefined;
    } while (pageToken);

    return out.closes.length >= 2 ? out : null;
  } catch {
    return null;
  }
}
