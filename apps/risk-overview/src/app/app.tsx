import { useEffect, useState } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { getInitialIsDark, applyDarkMode, onSystemThemeChange } from '@macro/macro-design';

export function App() {
  const [isDark, setIsDark] = useState(getInitialIsDark);
  useEffect(() => { applyDarkMode(isDark); }, [isDark]);
  useEffect(() => onSystemThemeChange((d) => setIsDark(d)), []);

  return (
    <BrowserRouter basename="/risk-overview/">
      <div style={{ height: '100vh', width: '100vw', background: 'var(--background)', color: 'var(--foreground)', fontFamily: 'Noto Sans, sans-serif' }}>
        {/* TODO: Replace with your Figma Make root component import */}
        <div style={{ padding: 24 }}>
          <h1 style={{ fontSize: 20, fontWeight: 600 }}>Risk Overview</h1>
          <p style={{ opacity: 0.6 }}>Sample risk monitoring dashboard</p>
          <p style={{ opacity: 0.4, fontSize: 12, marginTop: 16 }}>Edit apps/risk-overview/src/app/app.tsx to wire up your Figma components.</p>
        </div>
      </div>
    </BrowserRouter>
  );
}

export default App;
