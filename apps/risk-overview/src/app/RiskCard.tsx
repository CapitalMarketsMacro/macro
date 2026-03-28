export function RiskCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      padding: 16, borderRadius: 8,
      border: '1px solid var(--border)',
      background: 'var(--card)',
    }}>
      <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color }}>{value}</div>
    </div>
  );
}
