import { formatTreasury } from './treasury';

describe('formatTreasury (32nds — ported from app baseline)', () => {
  it('formats a whole number price', () => {
    expect(formatTreasury(100)).toBe('100-00');
  });

  it('formats exact 16/32 (half point)', () => {
    expect(formatTreasury(99.5)).toBe('99-16');
  });

  it('formats exact 8/32 (quarter point)', () => {
    expect(formatTreasury(99.25)).toBe('99-08');
  });

  it('formats exact 24/32 (three-quarter point)', () => {
    expect(formatTreasury(99.75)).toBe('99-24');
  });

  it('formats exact 1/32 with leading zero', () => {
    expect(formatTreasury(99.03125)).toBe('99-01');
  });

  it('formats double-digit 32nds', () => {
    expect(formatTreasury(99.46875)).toBe('99-15');
  });

  it('adds + for a half-32nd (>= 0.4 residual)', () => {
    expect(formatTreasury(99.515625)).toBe('99-16+');
  });

  it('omits + when residual is below threshold', () => {
    expect(formatTreasury(99.503125)).toBe('99-16');
  });

  it('handles 31/32', () => {
    expect(formatTreasury(99.96875)).toBe('99-31');
  });

  it('handles 0 and large handles', () => {
    expect(formatTreasury(0)).toBe('0-00');
    expect(formatTreasury(150.5)).toBe('150-16');
  });

  it('can disable the half-tick +', () => {
    expect(formatTreasury(99.515625, { plusTick: false })).toBe('99-16');
  });

  it('returns empty string for non-numbers', () => {
    expect(formatTreasury(NaN)).toBe('');
    expect(formatTreasury(undefined as unknown as number)).toBe('');
  });
});

describe('formatTreasury (64ths)', () => {
  it('formats 49/64', () => {
    // 99 + 49/64 = 99.765625
    expect(formatTreasury(99.765625, { fraction: 64, plusTick: false })).toBe('99-49');
  });

  it('formats 8/64 with leading zero', () => {
    // 99 + 8/64 = 99.125
    expect(formatTreasury(99.125, { fraction: 64 })).toBe('99-08');
  });
});
