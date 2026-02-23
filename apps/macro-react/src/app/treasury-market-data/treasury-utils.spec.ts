import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  formatTreasury32nd,
  getYearsToMaturity,
  calculateYield,
  calculateBidAsk,
  calculateDuration,
  calculateConvexity,
  round,
} from './treasury-utils';

describe('Treasury Utils', () => {
  describe('formatTreasury32nd', () => {
    it('should format a whole number price', () => {
      // 100.00 -> handle=100, 0/32 -> "100-00"
      expect(formatTreasury32nd(100)).toBe('100-00');
    });

    it('should format price with exact 16/32 (half point)', () => {
      // 99.50 -> handle=99, 0.50*32=16 -> "99-16"
      expect(formatTreasury32nd(99.5)).toBe('99-16');
    });

    it('should format price with exact 8/32 (quarter point)', () => {
      // 99.25 -> handle=99, 0.25*32=8 -> "99-08"
      expect(formatTreasury32nd(99.25)).toBe('99-08');
    });

    it('should format price with exact 24/32 (three-quarter point)', () => {
      // 99.75 -> handle=99, 0.75*32=24 -> "99-24"
      expect(formatTreasury32nd(99.75)).toBe('99-24');
    });

    it('should format price with exact 1/32', () => {
      // 99 + 1/32 = 99.03125 -> "99-01"
      expect(formatTreasury32nd(99.03125)).toBe('99-01');
    });

    it('should add leading zero for single-digit 32nds', () => {
      // 99 + 5/32 = 99.15625 -> "99-05"
      expect(formatTreasury32nd(99.15625)).toBe('99-05');
    });

    it('should handle no leading zero needed for double-digit 32nds', () => {
      // 99 + 15/32 = 99.46875 -> "99-15"
      expect(formatTreasury32nd(99.46875)).toBe('99-15');
    });

    it('should add + suffix for half-32nd in simple mode', () => {
      // 99 + 16.5/32 = 99 + 0.515625 = 99.515625
      // totalThirtySeconds = 0.515625 * 32 = 16.5
      // thirtySeconds=16, fraction=0.5 >= 0.4 -> "+"
      expect(formatTreasury32nd(99.515625)).toBe('99-16+');
    });

    it('should not add + suffix when fraction is below threshold', () => {
      // 99 + 16.1/32 = 99.503125
      // totalThirtySeconds = 0.503125 * 32 = 16.1
      // fraction = 0.1 < 0.4 -> no suffix
      expect(formatTreasury32nd(99.503125)).toBe('99-16');
    });

    it('should use eighths notation when useEighths=true', () => {
      // 99 + 16.25/32 = 99.5078125
      // totalThirtySeconds = 0.5078125 * 32 = 16.25
      // fraction = 0.25, eighths = round(0.25 * 8) = 2
      expect(formatTreasury32nd(99.5078125, true)).toBe('99-162');
    });

    it('should use eighths for 4/8 of a 32nd', () => {
      // 99 + 16.5/32 = 99.515625
      // fraction = 0.5, eighths = round(0.5 * 8) = 4
      expect(formatTreasury32nd(99.515625, true)).toBe('99-164');
    });

    it('should handle price near zero fractional part', () => {
      expect(formatTreasury32nd(100.0)).toBe('100-00');
    });

    it('should handle 31/32', () => {
      // 99 + 31/32 = 99.96875 -> "99-31"
      expect(formatTreasury32nd(99.96875)).toBe('99-31');
    });

    it('should handle price of 0', () => {
      expect(formatTreasury32nd(0)).toBe('0-00');
    });

    it('should handle large price handles', () => {
      expect(formatTreasury32nd(150.5)).toBe('150-16');
    });
  });

  describe('getYearsToMaturity', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should calculate years to maturity for a future date', () => {
      vi.setSystemTime(new Date('2025-01-01'));
      const ytm = getYearsToMaturity('2030-01-01');
      // Approximately 5 years
      expect(ytm).toBeCloseTo(5.0, 0);
    });

    it('should return approximately 1 year for 1 year out', () => {
      vi.setSystemTime(new Date('2025-06-15'));
      const ytm = getYearsToMaturity('2026-06-15');
      expect(ytm).toBeCloseTo(1.0, 1);
    });

    it('should return approximately 0 for today', () => {
      vi.setSystemTime(new Date('2025-06-15'));
      const ytm = getYearsToMaturity('2025-06-15');
      expect(ytm).toBeCloseTo(0, 1);
    });

    it('should return negative for past dates', () => {
      vi.setSystemTime(new Date('2025-06-15'));
      const ytm = getYearsToMaturity('2024-06-15');
      expect(ytm).toBeLessThan(0);
    });

    it('should handle 30-year bond maturity', () => {
      vi.setSystemTime(new Date('2025-01-01'));
      const ytm = getYearsToMaturity('2055-01-01');
      expect(ytm).toBeCloseTo(30.0, 0);
    });
  });

  describe('calculateYield', () => {
    it('should calculate yield for short-term T-Bill (< 0.5 years)', () => {
      // T-Bill: price=99.85, coupon=0, ytm=0.25
      const yld = calculateYield(99.85, 0, 0.25);
      // ((100-99.85)/99.85) * (365/(0.25*365)) * 100
      // = (0.15/99.85) * (1/0.25) * 100
      // = 0.001502... * 4 * 100 = 0.6008...
      expect(yld).toBeCloseTo(0.6008, 1);
    });

    it('should calculate yield for a T-Note (> 0.5 years)', () => {
      // T-Note: price=100, coupon=4.25, ytm=2
      const yld = calculateYield(100, 4.25, 2);
      // currentYield = (4.25/100)*100 = 4.25
      // capitalGain = ((100-100)/100)*(100/2) = 0
      // total = 4.25
      expect(yld).toBeCloseTo(4.25, 2);
    });

    it('should calculate yield for discount bond', () => {
      // price=98, coupon=4, ytm=5
      const yld = calculateYield(98, 4, 5);
      // currentYield = (4/98)*100 = 4.0816
      // capitalGain = ((100-98)/98)*(100/5) = (2/98)*20 = 0.4082
      // total = 4.4898
      expect(yld).toBeCloseTo(4.49, 1);
    });

    it('should calculate yield for premium bond', () => {
      // price=102, coupon=5, ytm=5
      const yld = calculateYield(102, 5, 5);
      // currentYield = (5/102)*100 = 4.9020
      // capitalGain = ((100-102)/102)*(100/5) = (-2/102)*20 = -0.3922
      // total = 4.5098
      expect(yld).toBeCloseTo(4.51, 1);
    });

    it('should handle zero coupon bond with longer maturity', () => {
      const yld = calculateYield(95, 0, 5);
      // currentYield = 0
      // capitalGain = ((100-95)/95)*(100/5) = (5/95)*20 = 1.0526
      expect(yld).toBeCloseTo(1.05, 1);
    });
  });

  describe('calculateBidAsk', () => {
    it('should calculate bid and ask symmetrically around mid', () => {
      const { bid, ask } = calculateBidAsk(100, 0.5);
      expect(bid).toBe(99.75);
      expect(ask).toBe(100.25);
    });

    it('should handle zero spread', () => {
      const { bid, ask } = calculateBidAsk(100, 0);
      expect(bid).toBe(100);
      expect(ask).toBe(100);
    });

    it('should handle small spread', () => {
      const { bid, ask } = calculateBidAsk(99.5, 0.03125);
      expect(bid).toBeCloseTo(99.484375, 6);
      expect(ask).toBeCloseTo(99.515625, 6);
    });

    it('should maintain that ask - bid equals spread', () => {
      const spread = 0.125;
      const { bid, ask } = calculateBidAsk(100, spread);
      expect(ask - bid).toBeCloseTo(spread, 10);
    });
  });

  describe('calculateDuration', () => {
    it('should return years to maturity for short-term (< 0.5 years)', () => {
      expect(calculateDuration(0.25, 0, 4.0)).toBe(0.25);
      expect(calculateDuration(0.1, 2, 3.0)).toBe(0.1);
    });

    it('should return n for zero coupon bond with long maturity', () => {
      // When coupon=0, duration = n (regardless of yield)
      expect(calculateDuration(5, 0, 4.0)).toBe(5);
      expect(calculateDuration(10, 0, 5.0)).toBe(10);
    });

    it('should calculate Macaulay duration for coupon bond', () => {
      const duration = calculateDuration(10, 4.0, 4.0);
      // For a 10-year bond with 4% coupon and 4% yield:
      // Duration should be less than maturity
      expect(duration).toBeGreaterThan(0);
      expect(duration).toBeLessThan(10);
    });

    it('should decrease with higher coupon', () => {
      const lowCoupon = calculateDuration(10, 2, 4);
      const highCoupon = calculateDuration(10, 6, 4);
      expect(highCoupon).toBeLessThan(lowCoupon);
    });

    it('should decrease with higher yield', () => {
      const lowYield = calculateDuration(10, 4, 2);
      const highYield = calculateDuration(10, 4, 8);
      expect(highYield).toBeLessThan(lowYield);
    });

    it('should be approximately equal to maturity for very low coupon', () => {
      const duration = calculateDuration(5, 0.01, 4);
      // Very low coupon => duration ~ maturity
      expect(duration).toBeCloseTo(5, 0);
    });
  });

  describe('calculateConvexity', () => {
    it('should return squared years for short-term (< 0.5 years)', () => {
      expect(calculateConvexity(0.25, 0, 4.0)).toBeCloseTo(0.0625, 4);
      expect(calculateConvexity(0.3, 2, 3.0)).toBeCloseTo(0.09, 4);
    });

    it('should calculate convexity for a bond', () => {
      const convexity = calculateConvexity(10, 4, 4);
      // (10 * 11) / (1.04)^2 = 110 / 1.0816 = 101.7
      expect(convexity).toBeCloseTo(101.7, 0);
    });

    it('should increase with maturity', () => {
      const short = calculateConvexity(5, 4, 4);
      const long = calculateConvexity(30, 4, 4);
      expect(long).toBeGreaterThan(short);
    });

    it('should decrease with higher yield', () => {
      const lowYield = calculateConvexity(10, 4, 2);
      const highYield = calculateConvexity(10, 4, 8);
      expect(highYield).toBeLessThan(lowYield);
    });

    it('should be independent of coupon in this formula', () => {
      // The formula used does not depend on coupon (for ytm >= 0.5)
      const c2 = calculateConvexity(10, 2, 4);
      const c6 = calculateConvexity(10, 6, 4);
      expect(c2).toBeCloseTo(c6, 4);
    });
  });

  describe('round', () => {
    it('should round to 0 decimals', () => {
      expect(round(1.5, 0)).toBe(2);
      expect(round(1.4, 0)).toBe(1);
    });

    it('should round to 2 decimals', () => {
      expect(round(1.555, 2)).toBe(1.56);
      expect(round(1.554, 2)).toBe(1.55);
    });

    it('should round to 4 decimals', () => {
      expect(round(1.23456, 4)).toBe(1.2346);
    });

    it('should handle negative numbers', () => {
      expect(round(-1.555, 2)).toBe(-1.55);
    });

    it('should handle zero', () => {
      expect(round(0, 2)).toBe(0);
    });

    it('should handle already-rounded values', () => {
      expect(round(1.5, 2)).toBe(1.5);
    });

    it('should handle large number of decimals', () => {
      expect(round(1.123456789, 6)).toBe(1.123457);
    });
  });
});
