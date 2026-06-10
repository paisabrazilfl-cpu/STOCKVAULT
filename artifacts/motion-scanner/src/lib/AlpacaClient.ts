const BASE_URL = import.meta.env.VITE_ALPACA_PAPER_URL || "https://paper-api.alpaca.markets";
const DATA_URL = import.meta.env.VITE_ALPACA_DATA_URL || "https://data.alpaca.markets";

const getHeaders = () => ({
  "APCA-API-KEY-ID": import.meta.env.VITE_ALPACA_API_KEY || "",
  "APCA-API-SECRET-KEY": import.meta.env.VITE_ALPACA_SECRET_KEY || "",
  "Content-Type": "application/json",
});

export interface OrderParams {
  symbol: string;
  side: "buy" | "sell";
  qty: string;
  type: "market" | "limit" | "stop" | "stop_limit";
  limit_price?: string;
  client_order_id?: string;
}

export const alpacaClient = {
  async getAccount() {
    const res = await fetch(`${BASE_URL}/v2/account`, { headers: getHeaders() });
    if (!res.ok) throw new Error(`Account fetch failed: ${res.statusText}`);
    return res.json();
  },
  async submitOrder(params: OrderParams) {
    const res = await fetch(`${BASE_URL}/v2/orders`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ ...params, time_in_force: "day" }),
    });
    if (!res.ok) throw new Error(`Order submit failed: ${res.statusText}`);
    return res.json();
  },
  async getPositions() {
    const res = await fetch(`${BASE_URL}/v2/positions`, { headers: getHeaders() });
    if (!res.ok) throw new Error(`Positions fetch failed: ${res.statusText}`);
    return res.json();
  },
  async getLatestQuote(symbol: string) {
    const res = await fetch(`${DATA_URL}/v2/stocks/${symbol}/quotes/latest`, { headers: getHeaders() });
    if (!res.ok) throw new Error(`Quote fetch failed: ${res.statusText}`);
    return res.json();
  },
  async getClock() {
    const res = await fetch(`${BASE_URL}/v2/clock`, { headers: getHeaders() });
    if (!res.ok) throw new Error(`Clock fetch failed: ${res.statusText}`);
    return res.json();
  },
  async getBars(symbol: string, timeframe: string = "1Day") {
    const res = await fetch(`${DATA_URL}/v2/stocks/${symbol}/bars?timeframe=${timeframe}`, { headers: getHeaders() });
    if (!res.ok) throw new Error(`Bars fetch failed: ${res.statusText}`);
    return res.json();
  }
};
