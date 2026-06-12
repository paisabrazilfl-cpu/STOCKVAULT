import React from 'react';
import { useRunScreener, getRunScreenerQueryKey } from "@workspace/api-client-react";
import type { CandidateRecord } from "@workspace/api-client-react";

// Alex's preset: $1–$10 price · ≥20% 1-month momentum · ≤10% from 52w high · 2× range
const ALEX_PARAMS = {
  priceMin: 1,
  priceMax: 10,
  mom1mMin: 0.20,
  nearHigh52wPct: 0.10,
};

export const AlexScreener: React.FC = () => {
  const { data, isFetching, error, refetch } = useRunScreener(ALEX_PARAMS, {
    query: {
      enabled: false,
      retry: 1,
      queryKey: getRunScreenerQueryKey(ALEX_PARAMS),
    },
  });

  // Filter for 2× 52-week range (high/low ≥ 2)
  const candidates: CandidateRecord[] = (data?.results ?? []).filter((c) => {
    const tech = c.technical as Record<string, unknown> | null ?? {};
    const high52w = Number(tech.high52w ?? 0);
    const low52w = Number(tech.low52w ?? 0);
    return high52w > 0 && low52w > 0 && high52w / low52w >= 2;
  });

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 max-w-5xl mx-auto mb-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 tracking-tight">Alex's Screener</h2>
          <p className="text-gray-500 text-base mt-1">2× Range · $1–$10 · ≥20% MoM · ≤10% from High</p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="px-6 py-3 bg-black text-white rounded-xl font-semibold text-base hover:bg-gray-800 transition disabled:opacity-50 flex items-center gap-2"
        >
          {isFetching ? 'Scanning…' : 'Run Screener'}
        </button>
      </div>

      {error && (
        <div className="mb-6 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          {(error as Error)?.message ?? 'Failed to run screener — is the API server running?'}
        </div>
      )}

      {isFetching && (
        <div className="py-16 text-center text-gray-400 text-sm">
          Scanning live market data…
        </div>
      )}

      {!isFetching && !error && !data && (
        <div className="py-16 text-center text-gray-400 text-sm bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
          Click 'Run Screener' to fetch live candidates matching the Alex preset.
        </div>
      )}

      {!isFetching && data && candidates.length === 0 && (
        <div className="py-8 text-center text-gray-400 text-sm bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
          No tickers matched all Alex criteria right now — try again during market hours.
        </div>
      )}

      {candidates.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-100 text-sm text-gray-500">
                <th className="pb-4 font-medium pl-2">Symbol</th>
                <th className="pb-4 font-medium">Price</th>
                <th className="pb-4 font-medium">MoM</th>
                <th className="pb-4 font-medium">% from High</th>
                <th className="pb-4 font-medium">Score</th>
                <th className="pb-4 font-medium">Verdict</th>
              </tr>
            </thead>
            <tbody className="text-gray-900 text-base">
              {candidates.map((c) => {
                const tech = c.technical as Record<string, unknown> | null ?? {};
                const price = Number(tech.price ?? 0);
                const mom1m = Number(tech.mom1m ?? 0);
                const high52w = Number(tech.high52w ?? 0);
                const pctFromHigh = high52w > 0 ? (high52w - price) / high52w : 0;
                const score = Number(c.score ?? 0);
                return (
                  <tr key={c.ticker} className="border-b border-gray-50 hover:bg-gray-50/50 transition">
                    <td className="py-5 font-semibold pl-2">{c.ticker}</td>
                    <td className="py-5">${price.toFixed(2)}</td>
                    <td className={`py-5 font-semibold ${mom1m >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {mom1m >= 0 ? '+' : ''}{(mom1m * 100).toFixed(1)}%
                    </td>
                    <td className="py-5 text-gray-600">
                      -{(pctFromHigh * 100).toFixed(1)}%
                    </td>
                    <td className="py-5 pr-4">
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-gray-100 rounded-full h-2">
                          <div
                            className="bg-black h-2 rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(100, score)}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500 font-mono">{score.toFixed(0)}</span>
                      </div>
                    </td>
                    <td className="py-5">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                        c.verdict === 'GO'   ? 'bg-green-100 text-green-800' :
                        c.verdict === 'HOLD' ? 'bg-yellow-100 text-yellow-800' :
                                               'bg-red-100 text-red-800'
                      }`}>
                        {c.verdict}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
