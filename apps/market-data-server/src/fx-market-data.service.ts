/**
 * FX Market Data Service
 * Generates realistic FX market data for G10 currencies
 */

export interface CurrencyPair {
  base: string;
  quote: string;
  symbol: string;
  bid: number;
  ask: number;
  mid: number;
  spread: number;
  change: number;
  changePercent: number;
}

export interface MarketData {
  pairs: CurrencyPair[];
  timestamp: string;
}

export class FxMarketDataService {
  // G10 currencies: USD, EUR, GBP, JPY, AUD, CAD, CHF, NZD, SEK, NOK
  private readonly currencies = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'NZD', 'SEK', 'NOK'];
  
  // Base rates (mid prices) - these will fluctuate
  private baseRates: Map<string, number> = new Map([
    ['EURUSD', 1.0850],
    ['GBPUSD', 1.2650],
    ['USDJPY', 149.50],
    ['AUDUSD', 0.6550],
    ['USDCAD', 1.3650],
    ['USDCHF', 0.8850],
    ['NZDUSD', 0.6050],
    ['USDSEK', 10.8500],
    ['USDNOK', 10.9500],
    ['EURGBP', 0.8570],
    ['EURJPY', 162.30],
    ['GBPJPY', 189.20],
    ['AUDJPY', 97.90],
    ['EURCHF', 0.9600],
    ['GBPCHF', 1.1200],
  ]);

  // Volatility factors for each pair
  private volatility: Map<string, number> = new Map([
    ['EURUSD', 0.0005],
    ['GBPUSD', 0.0008],
    ['USDJPY', 0.15],
    ['AUDUSD', 0.0006],
    ['USDCAD', 0.0007],
    ['USDCHF', 0.0005],
    ['NZDUSD', 0.0008],
    ['USDSEK', 0.02],
    ['USDNOK', 0.02],
    ['EURGBP', 0.0003],
    ['EURJPY', 0.20],
    ['GBPJPY', 0.25],
    ['AUDJPY', 0.18],
    ['EURCHF', 0.0004],
    ['GBPCHF', 0.0005],
  ]);

  /**
   * Generate random price movement
   */
  private randomWalk(currentPrice: number, volatility: number): number {
    const change = (Math.random() - 0.5) * 2 * volatility;
    return currentPrice + change;
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
   * Get current market data for all G10 currency pairs
   */
  getMarketData(): MarketData {
    const pairs: CurrencyPair[] = [];

    // Generate data for major pairs
    for (const [symbol, baseRate] of this.baseRates.entries()) {
      const vol = this.volatility.get(symbol) || 0.001;
      
      // Update base rate with random walk
      const newMid = this.randomWalk(baseRate, vol);
      this.baseRates.set(symbol, newMid);

      // Calculate spread (typically 1-5 pips for major pairs)
      const isJPY = symbol.includes('JPY');
      const pipSize = isJPY ? 0.01 : 0.0001;
      const spreadPips = 1 + Math.random() * 4; // 1-5 pips
      const spread = spreadPips * pipSize;

      const { bid, ask } = this.calculateBidAsk(newMid, spread);

      // Calculate change (simplified - compare to previous value)
      const change = (Math.random() - 0.5) * vol * 2;
      const changePercent = (change / baseRate) * 100;

      pairs.push({
        base: symbol.substring(0, 3),
        quote: symbol.substring(3),
        symbol,
        bid: this.round(bid, isJPY ? 2 : 5),
        ask: this.round(ask, isJPY ? 2 : 5),
        mid: this.round(newMid, isJPY ? 2 : 5),
        spread: this.round(spread, isJPY ? 2 : 5),
        change: this.round(change, isJPY ? 2 : 5),
        changePercent: this.round(changePercent, 4),
      });
    }

    return {
      pairs,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Round to specified decimal places
   */
  private round(value: number, decimals: number): number {
    return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
  }

  /**
   * Get list of supported currencies
   */
  getCurrencies(): string[] {
    return [...this.currencies];
  }
}

