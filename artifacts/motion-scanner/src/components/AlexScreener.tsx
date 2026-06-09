import React, { useState, useEffect } from 'react';

export const AlexScreener: React.FC = () => {
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    setTimeout(() => {
      setResults([
        { ticker: "TECH", price: 5.40, mom: 22.5, fromHigh: 8.0, range2x: true },
        { ticker: "BIOT", price: 8.10, mom: 20.1, fromHigh: 5.0, range2x: true },
        { ticker: "NANO", price: 3.25, mom: 25.0, fromHigh: 9.5, range2x: true },
      ]);
      setLoading(false);
    }, 800);
  }, []);

  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", sans-serif', background: '#ffffff', borderRadius: '24px', padding: '32px', boxShadow: '0 12px 40px rgba(0, 0, 0, 0.06)', maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <h2 style={{ fontSize: '32px', fontWeight: 800, letterSpacing: '-0.03em', margin: 0 }}>Alex's Screener</h2>
        <p style={{ color: '#6e6e73', fontSize: '16px', marginTop: '8px' }}>2× Range · $1-$10 · 20% MoM · ≤10% from High</p>
      </div>
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#0071e3' }}>Scanning markets...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
          {results.map((item, idx) => (
            <div key={idx} style={{ background: '#f5f5f7', borderRadius: '18px', padding: '24px', border: '1px solid rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize: '28px', fontWeight: 800, color: '#0b0b0f' }}>{item.ticker}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px', color: '#6e6e73', fontSize: '14px' }}>
                <span>Price: <strong style={{color: '#0b0b0f'}}>${item.price}</strong></span>
                <span>MoM: <strong style={{color: '#20c997'}}>{item.mom}%</strong></span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', color: '#6e6e73', fontSize: '14px' }}>
                <span>From High: <strong style={{color: '#0b0b0f'}}>{item.fromHigh}%</strong></span>
                <span>2× Range: <strong style={{color: '#0071e3'}}>{item.range2x ? 'Yes' : 'No'}</strong></span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
export default AlexScreener;
