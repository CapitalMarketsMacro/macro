/**
 * Format Treasury price in 32nd format (e.g., 99-16 means 99 and 16/32)
 * Similar to Angular pipes for Treasury price formatting
 *
 * @param decimalPrice - Decimal price (e.g., 99.50)
 * @param useEighths - Whether to use eighths instead of simple notation
 * @returns Formatted string in 32nd format (e.g., "99-16")
 */
export const formatTreasury32nd = (decimalPrice: number, useEighths = false): string => {
  const handle = Math.floor(decimalPrice);
  const fractionalPart = decimalPrice - handle;

  // Convert the fractional part to 32nds
  const totalThirtySeconds = fractionalPart * 32;

  // Get the whole number of 32nds
  const thirtySeconds = Math.floor(totalThirtySeconds);

  // Get the remaining fraction of a 32nd
  const fractionOfThirtySecond = totalThirtySeconds - thirtySeconds;

  // Format the 32nds part with leading zero if needed
  const thirtySecondsStr = thirtySeconds.toString().padStart(2, '0');

  // Determine the fraction suffix
  let fractionSuffix = '';

  if (useEighths && fractionOfThirtySecond > 0.001) {
    // Convert to eighths (1/8 of a 32nd increments)
    // Round to nearest eighth
    const eighths = Math.round(fractionOfThirtySecond * 8);
    if (eighths > 0 && eighths < 8) {
      fractionSuffix = eighths.toString();
    }
  } else if (fractionOfThirtySecond >= 0.4) {
    // If using simple notation, '+' represents 1/2 of a 32nd
    // Use threshold of 0.4 to round to nearest half
    fractionSuffix = '+';
  }

  return `${handle}-${thirtySecondsStr}${fractionSuffix}`;
};

export const getYearsToMaturity = (maturityDate: string): number => {
  const maturity = new Date(maturityDate);
  const today = new Date();
  const diffTime = maturity.getTime() - today.getTime();
  const diffDays = diffTime / (1000 * 60 * 60 * 24);
  return diffDays / 365.25;
};

export const calculateYield = (price: number, coupon: number, yearsToMaturity: number): number => {
  if (yearsToMaturity < 0.5) {
    return ((100 - price) / price) * (365 / (yearsToMaturity * 365)) * 100;
  }
  const annualCoupon = coupon;
  const faceValue = 100;
  const currentYield = (annualCoupon / price) * 100;
  const capitalGain = ((faceValue - price) / price) * (100 / yearsToMaturity);
  return currentYield + capitalGain;
};

export const calculateBidAsk = (mid: number, spread: number): { bid: number; ask: number } => {
  const halfSpread = spread / 2;
  return {
    bid: mid - halfSpread,
    ask: mid + halfSpread,
  };
};

export const calculateDuration = (yearsToMaturity: number, coupon: number, yieldRate: number): number => {
  if (yearsToMaturity < 0.5) {
    return yearsToMaturity;
  }
  const c = coupon / 100;
  const y = yieldRate / 100;
  const n = yearsToMaturity;
  if (c === 0) {
    return n;
  }
  return (1 + y) / y - ((1 + y) + n * (c - y)) / (c * (Math.pow(1 + y, n) - 1) + y);
};

export const calculateConvexity = (yearsToMaturity: number, coupon: number, yieldRate: number): number => {
  if (yearsToMaturity < 0.5) {
    return yearsToMaturity * yearsToMaturity;
  }
  const n = yearsToMaturity;
  return (n * (n + 1)) / Math.pow(1 + yieldRate / 100, 2);
};

export const round = (value: number, decimals: number): number => {
  return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
};
