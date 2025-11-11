/**
 * US Treasury Market Data Service
 * Generates realistic US Treasury prices and yields for various maturities
 */

export interface TreasurySecurity {
  cusip: string;
  securityType: 'T-Bill' | 'T-Note' | 'T-Bond';
  maturity: string; // YYYY-MM-DD
  yearsToMaturity: number;
  coupon: number; // Annual coupon rate in percentage
  price: number; // Price per $100 face value
  yield: number; // Yield to maturity in percentage
  bid: number;
  ask: number;
  spread: number;
  change: number;
  changePercent: number;
  volume: number; // Trading volume in millions
  duration: number; // Modified duration
  convexity: number;
}

export interface TsyMarketData {
  securities: TreasurySecurity[];
  timestamp: string;
  benchmarkRates: {
    '2Y': number;
    '5Y': number;
    '10Y': number;
    '30Y': number;
  };
}

export class TsyMarketDataService {
  // Treasury securities with their base characteristics
  private securities: Array<{
    cusip: string;
    securityType: 'T-Bill' | 'T-Note' | 'T-Bond';
    maturity: string;
    coupon: number;
    basePrice: number;
    baseYield: number;
    volatility: number;
  }> = [
    // T-Bills (zero coupon)
    { cusip: '912797XZ8', securityType: 'T-Bill', maturity: '2025-12-15', coupon: 0, basePrice: 99.85, baseYield: 4.25, volatility: 0.05 },
    { cusip: '912797YF5', securityType: 'T-Bill', maturity: '2026-03-15', coupon: 0, basePrice: 99.70, baseYield: 4.30, volatility: 0.05 },
    { cusip: '912797YG3', securityType: 'T-Bill', maturity: '2026-06-15', coupon: 0, basePrice: 99.55, baseYield: 4.35, volatility: 0.05 },
    
    // T-Notes (2-10 years)
    { cusip: '91282CJX8', securityType: 'T-Note', maturity: '2026-11-15', coupon: 4.25, basePrice: 99.95, baseYield: 4.28, volatility: 0.10 },
    { cusip: '91282CJY6', securityType: 'T-Note', maturity: '2027-11-15', coupon: 4.50, basePrice: 100.10, baseYield: 4.35, volatility: 0.12 },
    { cusip: '91282CJZ3', securityType: 'T-Note', maturity: '2028-11-15', coupon: 4.75, basePrice: 100.25, baseYield: 4.40, volatility: 0.15 },
    { cusip: '91282CKA0', securityType: 'T-Note', maturity: '2029-11-15', coupon: 4.50, basePrice: 100.00, baseYield: 4.45, volatility: 0.18 },
    { cusip: '91282CKB8', securityType: 'T-Note', maturity: '2030-11-15', coupon: 4.25, basePrice: 99.75, baseYield: 4.50, volatility: 0.20 },
    
    // T-Notes (10 years)
    { cusip: '91282CKC6', securityType: 'T-Note', maturity: '2034-11-15', coupon: 4.00, basePrice: 99.50, baseYield: 4.55, volatility: 0.25 },
    
    // T-Bonds (20-30 years)
    { cusip: '912810QZ8', securityType: 'T-Bond', maturity: '2044-11-15', coupon: 4.25, basePrice: 99.00, baseYield: 4.60, volatility: 0.30 },
    { cusip: '912810RA5', securityType: 'T-Bond', maturity: '2054-11-15', coupon: 4.50, basePrice: 98.50, baseYield: 4.65, volatility: 0.35 },
  ];

  private currentPrices: Map<string, number> = new Map();
  private currentYields: Map<string, number> = new Map();

  constructor() {
    // Initialize current prices and yields
    this.securities.forEach(sec => {
      this.currentPrices.set(sec.cusip, sec.basePrice);
      this.currentYields.set(sec.cusip, sec.baseYield);
    });
  }

  /**
   * Calculate years to maturity
   */
  private getYearsToMaturity(maturityDate: string): number {
    const maturity = new Date(maturityDate);
    const today = new Date();
    const diffTime = maturity.getTime() - today.getTime();
    const diffDays = diffTime / (1000 * 60 * 60 * 24);
    return diffDays / 365.25;
  }

  /**
   * Generate random price movement
   */
  private randomWalk(currentPrice: number, volatility: number): number {
    const change = (Math.random() - 0.5) * 2 * volatility;
    return currentPrice + change;
  }

  /**
   * Calculate yield from price (simplified)
   */
  private calculateYield(price: number, coupon: number, yearsToMaturity: number): number {
    if (yearsToMaturity < 0.5) {
      // For T-Bills, use simple yield calculation
      return ((100 - price) / price) * (365 / (yearsToMaturity * 365)) * 100;
    }
    // Simplified yield calculation for notes and bonds
    const annualCoupon = coupon;
    const faceValue = 100;
    const currentYield = (annualCoupon / price) * 100;
    const capitalGain = ((faceValue - price) / price) * (100 / yearsToMaturity);
    return currentYield + capitalGain;
  }

  /**
   * Calculate bid/ask from mid price
   */
  private calculateBidAsk(mid: number, spread: number): { bid: number; ask: number } {
    const halfSpread = spread / 2;
    return {
      bid: mid - halfSpread,
      ask: mid + halfSpread,
    };
  }

  /**
   * Calculate duration (simplified)
   */
  private calculateDuration(yearsToMaturity: number, coupon: number, yieldRate: number): number {
    if (yearsToMaturity < 0.5) {
      return yearsToMaturity;
    }
    // Simplified Macaulay duration approximation
    const c = coupon / 100;
    const y = yieldRate / 100;
    const n = yearsToMaturity;
    
    if (c === 0) {
      return n; // Zero coupon
    }
    
    // Approximate duration
    return (1 + y) / y - ((1 + y) + n * (c - y)) / (c * ((1 + y) ** n - 1) + y);
  }

  /**
   * Calculate convexity (simplified)
   */
  private calculateConvexity(yearsToMaturity: number, coupon: number, yieldRate: number): number {
    if (yearsToMaturity < 0.5) {
      return yearsToMaturity * yearsToMaturity;
    }
    // Simplified convexity approximation
    const n = yearsToMaturity;
    return n * (n + 1) / ((1 + yieldRate / 100) ** 2);
  }

  /**
   * Get current market data for all Treasury securities
   */
  getMarketData(): TsyMarketData {
    const securities: TreasurySecurity[] = [];
    const benchmarkRates: { '2Y': number; '5Y': number; '10Y': number; '30Y': number } = {
      '2Y': 0,
      '5Y': 0,
      '10Y': 0,
      '30Y': 0,
    };

    for (const sec of this.securities) {
      const currentPrice = this.currentPrices.get(sec.cusip) || sec.basePrice;
      const currentYield = this.currentYields.get(sec.cusip) || sec.baseYield;
      
      // Update price with random walk
      const newPrice = this.randomWalk(currentPrice, sec.volatility);
      this.currentPrices.set(sec.cusip, newPrice);

      // Calculate yield from new price
      const yearsToMaturity = this.getYearsToMaturity(sec.maturity);
      const newYield = this.calculateYield(newPrice, sec.coupon, yearsToMaturity);
      this.currentYields.set(sec.cusip, newYield);

      // Calculate spread (typically 1-3 ticks for Treasuries)
      const tickSize = 0.03125; // 1/32 of a point
      const spreadTicks = 1 + Math.random() * 2; // 1-3 ticks
      const spread = spreadTicks * tickSize;

      const { bid, ask } = this.calculateBidAsk(newPrice, spread);

      // Calculate change
      const change = newPrice - currentPrice;
      const changePercent = (change / currentPrice) * 100;

      // Calculate duration and convexity
      const duration = this.calculateDuration(yearsToMaturity, sec.coupon, newYield);
      const convexity = this.calculateConvexity(yearsToMaturity, sec.coupon, newYield);

      // Generate trading volume (in millions)
      const volume = Math.random() * 500 + 50; // 50-550 million

      // Update benchmark rates
      if (yearsToMaturity >= 1.5 && yearsToMaturity < 2.5) {
        benchmarkRates['2Y'] = newYield;
      } else if (yearsToMaturity >= 4.5 && yearsToMaturity < 5.5) {
        benchmarkRates['5Y'] = newYield;
      } else if (yearsToMaturity >= 9.5 && yearsToMaturity < 10.5) {
        benchmarkRates['10Y'] = newYield;
      } else if (yearsToMaturity >= 29.5 && yearsToMaturity < 30.5) {
        benchmarkRates['30Y'] = newYield;
      }

      securities.push({
        cusip: sec.cusip,
        securityType: sec.securityType,
        maturity: sec.maturity,
        yearsToMaturity: this.round(yearsToMaturity, 2),
        coupon: sec.coupon,
        price: this.round(newPrice, 4),
        yield: this.round(newYield, 4),
        bid: this.round(bid, 4),
        ask: this.round(ask, 4),
        spread: this.round(spread, 4),
        change: this.round(change, 4),
        changePercent: this.round(changePercent, 4),
        volume: this.round(volume, 2),
        duration: this.round(duration, 2),
        convexity: this.round(convexity, 2),
      });
    }

    return {
      securities,
      timestamp: new Date().toISOString(),
      benchmarkRates: {
        '2Y': this.round(benchmarkRates['2Y'] || 4.30, 4),
        '5Y': this.round(benchmarkRates['5Y'] || 4.45, 4),
        '10Y': this.round(benchmarkRates['10Y'] || 4.55, 4),
        '30Y': this.round(benchmarkRates['30Y'] || 4.65, 4),
      },
    };
  }

  /**
   * Round to specified decimal places
   */
  private round(value: number, decimals: number): number {
    return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
  }

  /**
   * Get list of supported securities
   */
  getSecurities(): Array<{ cusip: string; securityType: string; maturity: string }> {
    return this.securities.map(sec => ({
      cusip: sec.cusip,
      securityType: sec.securityType,
      maturity: sec.maturity,
    }));
  }
}

