import { RiskCard } from './RiskCard';

export function RiskDashboard() {
  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>Risk Overview</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
        <RiskCard label="VaR (95%)" value="$2.4M" color="#ef4444" />
        <RiskCard label="P&L Today" value="+$380K" color="#10b981" />
        <RiskCard label="Exposure" value="$142M" color="#3b82f6" />
        <RiskCard label="Greeks Delta" value="-0.42" color="#f59e0b" />
      </div>
    </div>
  );
}
