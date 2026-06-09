import React from 'react';
import { AlexScreener } from './components/AlexScreener';

export const App: React.FC = () => {
  return (
    <div style={{ background: 'linear-gradient(180deg, #ffffff 0%, #f7f8fb 100%)', minHeight: '100vh', padding: '40px 20px', fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", sans-serif' }}>
      <header style={{ textAlign: 'center', marginBottom: '48px' }}>
        <h1 style={{ fontSize: 'clamp(32px, 5vw, 56px)', fontWeight: 800, letterSpacing: '-0.05em', margin: 0 }}>STOCKVAULT</h1>
        <p style={{ color: '#6e6e73', fontSize: '18px', marginTop: '12px' }}>Institutional-grade market intelligence</p>
      </header>
      <main><AlexScreener /></main>
      <footer style={{ textAlign: 'center', marginTop: '64px', color: '#6e6e73', fontSize: '14px' }}>
        <p>© 2025 STOCKVAULT. Multi-tenant architecture enabled. NVIDIA AI integrated.</p>
      </footer>
    </div>
  );
};
export default App;
