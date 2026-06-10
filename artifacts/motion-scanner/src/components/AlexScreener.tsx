import React, { useState } from 'react';

export const AlexScreener: React.FC = () => {
  const [candidates, setCandidates] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const runScreener = async () => {
    setLoading(true);
    await new Promise(resolve => setTimeout(resolve, 800));
    setCandidates([
      { symbol: 'AAPL', price: 5.50, high52w: 6.00, low52w: 3.00, mom1m: 0.25, score: 85, verdict: 'GO' },
      { symbol: 'NVDA', price: 8.00, high52w: 8.50, low52w: 7.00, mom1m: 0.22, score: 92, verdict: 'GO' },
      { symbol: 'TSLA', price: 9.50, high52w: 10.00, low52w: 8.00, mom1m: 0.21, score: 78, verdict: 'HOLD' },
    ]);
    setLoading(false);
  };

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 max-w-5xl mx-auto mb-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 tracking-tight">Alex's Screener</h2>
          <p className="text-gray-500 text-base mt-1">2x Range · $1–$10 · ≥20% MoM · ≤10% from High</p>
        </div>
        <button 
          onClick={runScreener}
          disabled={loading}
          className="px-6 py-3 bg-black text-white rounded-xl font-semibold text-base hover:bg-gray-800 transition disabled:opacity-50 flex items-center gap-2"
        >
          {loading ? 'Scanning...' : 'Run Screener'}
        </button>
      </div>

      {candidates.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-100 text-sm text-gray-500">
                <th className="pb-4 font-medium pl-2">Symbol</th>
                <th className="pb-4 font-medium">Price</th>
                <th className="pb-4 font-medium">MoM</th>
                <th className="pb-4 font-medium">Score</th>
                <th className="pb-4 font-medium">Verdict</th>
              </tr>
            </thead>
            <tbody className="text-gray-900 text-base">
              {candidates.map((c, i) => (
                <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50 transition">
                  <td className="py-5 font-semibold pl-2">{c.symbol}</td>
                  <td className="py-5">${c.price.toFixed(2)}</td>
                  <td className="py-5 text-green-600 font-semibold">+{(c.mom1m * 100).toFixed(1)}%</td>
                  <td className="py-5 pr-4">
                    <div className="w-32 bg-gray-100 rounded-full h-2">
                      <div className="bg-black h-2 rounded-full transition-all duration-500" style={{ width: `${c.score}%` }}></div>
                    </div>
                  </td>
                  <td className="py-5">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      c.verdict === 'GO' ? 'bg-green-100 text-green-800' : 
                      c.verdict === 'HOLD' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {c.verdict}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="py-16 text-center text-gray-400 text-sm bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
          Click 'Run Screener' to fetch candidates matching the Alex preset.
        </div>
      )}
    </div>
  );
};
