/**
 * Provider registry — merges data from Yahoo, Polygon, and Finnhub.
 * Each provider is optional; Yahoo is always the baseline.
 */
export { fetchYahooChart, fetchYahooFundamentals, fetchSpyReturn } from "./yahoo";
export { fetchPolygonData, searchTickers } from "./polygon";
export { fetchFinnhubData } from "./finnhub";
export type { YahooQuoteResult, YahooFundamentals } from "./yahoo";
export type { PolygonData, PolygonQuote, PolygonOptionsFlow, PolygonNews, TickerRef } from "./polygon";
export type { FinnhubData, FinnhubQuote, FinnhubSentiment, FinnhubEarnings, FinnhubProfile } from "./finnhub";

export interface TenantProviderKeys {
  polygonKey?: string;
  finnhubKey?: string;
}
