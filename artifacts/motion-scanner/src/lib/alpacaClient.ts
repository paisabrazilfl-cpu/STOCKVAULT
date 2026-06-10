export interface AlpacaConfig {
  apiKey?: string;
  secretKey?: string;
  live?: boolean;
}

export interface Account {
  id: string;
  equity: string;
  buying_power: string;
  cash: string;
  portfolio_value?: string;
  status: string;
}

export interface Position {
  symbol: string;
  qty: string;
  avg_entry_price: string;
  market_value: string;
  unrealized_pl: string;
  unrealized_plpc: string;
  current_price?: string;
}

export interface Order {
  id: string;
  client_order_id?: string;
  created_at: string;
  updated_at: string;
  submitted_at?: string;
  filled_at?: string;
  expired_at?: string;
  canceled_at?: string;
  symbol: string;
  side: 'buy' | 'sell';
  qty: string;
  type: 'market' | 'limit' | 'stop' | 'stop_limit' | 'trailing_stop';
  time_in_force: 'day' | 'gtc' | 'opg' | 'cls' | 'ioc' | 'fok';
  limit_price?: string;
  stop_price?: string;
  status: string;
}

export interface Bar {
  t: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  vw?: number;
}

export interface Clock {
  timestamp: string;
  is_open: boolean;
  next_open: string;
  next_close: string;
}

export class AlpacaClient {
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(config: AlpacaConfig = {}) {
    const useLive = config.live ?? (typeof import.meta !== 'undefined' ? import.meta.env?.VITE_ALPACA_LIVE_TRADE === 'true' : process.env.ALPACA_LIVE_TRADE === 'true');
    this.baseUrl = useLive 
      ? 'https://api.alpaca.markets' 
      : 'https://paper-api.alpaca.markets';
    
    const apiKey = config.apiKey || (typeof import.meta !== 'undefined' ? import.meta.env?.VITE_ALPACA_API_KEY : process.env.ALPACA_API_KEY);
    const secretKey = config.secretKey || (typeof import.meta !== 'undefined' ? import.meta.env?.VITE_ALPACA_SECRET_KEY : process.env.ALPACA_SECRET_KEY);

    if (!apiKey || !secretKey) {
      throw new Error('ALPACA_API_KEY and ALPACA_SECRET_KEY must be set.');
    }

    this.headers = {
      'APCA-API-KEY-ID': apiKey,
      'APCA-API-SECRET-KEY': secretKey,
      'Content-Type': 'application/json',
    };
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: { ...this.headers, ...(options.headers as Record<string, string>) },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Alpaca API error (${response.status}): ${errorBody}`);
    }

    if (response.status === 204) {
      return {} as T;
    }

    return response.json() as Promise<T>;
  }

  async getAccount(): Promise<Account> {
    return this.request<Account>('/v2/account');
  }

  async getPositions(): Promise<Position[]> {
    return this.request<Position[]>('/v2/positions');
  }

  async listOrders(status: 'open' | 'closed' | 'all' = 'open'): Promise<Order[]> {
    return this.request<Order[]>(`/v2/orders?status=${status}`);
  }

  async submitOrder(payload: {
    symbol: string;
    qty: string | number;
    side: 'buy' | 'sell';
    type: 'market' | 'limit' | 'stop' | 'stop_limit' | 'trailing_stop';
    time_in_force?: 'day' | 'gtc' | 'opg' | 'cls' | 'ioc' | 'fok';
    limit_price?: string | number;
    stop_price?: string | number;
    client_order_id?: string;
  }): Promise<Order> {
    return this.request<Order>('/v2/orders', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async cancelOrder(orderId: string): Promise<void> {
    await this.request(`/v2/orders/${orderId}`, { method: 'DELETE' });
  }

  async cancelAllOrders(): Promise<void> {
    await this.request('/v2/orders', { method: 'DELETE' });
  }

  async getBars(symbol: string, timeframe: string, start: string, end?: string, limit?: number): Promise<Bar[]> {
    let params = `symbols=${symbol}&timeframe=${timeframe}&start=${start}`;
    if (end) params += `&end=${end}`;
    if (limit) params += `&limit=${limit}`;
    const data = await this.request<Record<string, Bar[]>>(`/v2/stocks/bars?${params}`);
    return data[symbol] || [];
  }

  async getLatestBar(symbol: string): Promise<Bar> {
    const data = await this.request<Record<string, { bar: Bar }>>(`/v2/stocks/bars/latest?symbols=${symbol}`);
    return data[symbol]?.bar;
  }

  async getClock(): Promise<Clock> {
    return this.request<Clock>('/v2/clock');
  }
}

export default AlpacaClient;
