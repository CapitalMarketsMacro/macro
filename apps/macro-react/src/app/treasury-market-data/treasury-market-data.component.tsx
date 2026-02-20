import { useEffect, useMemo, useState, useRef } from 'react';
import { Logger } from '@macro/logger';
import { MacroReactGrid, MacroReactGridRef } from '@macro/macro-react-grid';
import { useViewState } from '@macro/openfin/react';
import { GetRowIdParams, GridState } from 'ag-grid-community';

interface TreasurySecurity {
  id: string;
  cusip: string;
  securityType: 'T-Bill' | 'T-Note' | 'T-Bond';
  maturity: string;
  yearsToMaturity: number;
  coupon: number;
  price: number;
  yield: number;
  bid: number;
  ask: number;
  spread: number;
  change: number;
  changePercent: number;
  volume: number;
  duration: number;
  convexity: number;
}

const logger = Logger.getLogger('TreasuryMarketDataComponent');

/**
 * Format Treasury price in 32nd format (e.g., 99-16 means 99 and 16/32)
 * Similar to Angular pipes for Treasury price formatting
 *
 * @param decimalPrice - Decimal price (e.g., 99.50)
 * @param useEighths - Whether to use eighths instead of simple notation
 * @returns Formatted string in 32nd format (e.g., "99-16")
 */
const formatTreasury32nd = (decimalPrice: number, useEighths = false): string => {
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

export function TreasuryMarketDataComponent() {
  const gridRef = useRef<MacroReactGridRef>(null);
  const [viewState, savedState, isRestored] = useViewState();

  // Treasury Market Data state
  const securitiesRef = useRef<Array<{
    cusip: string;
    securityType: 'T-Bill' | 'T-Note' | 'T-Bond';
    maturity: string;
    coupon: number;
    basePrice: number;
    baseYield: number;
    volatility: number;
  }>>([
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
  ]);

  const currentPricesRef = useRef<Map<string, number>>(new Map());
  const currentYieldsRef = useRef<Map<string, number>>(new Map());
  const previousPricesRef = useRef<Map<string, number>>(new Map());

  // Helper functions
  const getYearsToMaturity = (maturityDate: string): number => {
    const maturity = new Date(maturityDate);
    const today = new Date();
    const diffTime = maturity.getTime() - today.getTime();
    const diffDays = diffTime / (1000 * 60 * 60 * 24);
    return diffDays / 365.25;
  };

  const calculateYield = (price: number, coupon: number, yearsToMaturity: number): number => {
    if (yearsToMaturity < 0.5) {
      return ((100 - price) / price) * (365 / (yearsToMaturity * 365)) * 100;
    }
    const annualCoupon = coupon;
    const faceValue = 100;
    const currentYield = (annualCoupon / price) * 100;
    const capitalGain = ((faceValue - price) / price) * (100 / yearsToMaturity);
    return currentYield + capitalGain;
  };

  const calculateBidAsk = (mid: number, spread: number): { bid: number; ask: number } => {
    const halfSpread = spread / 2;
    return {
      bid: mid - halfSpread,
      ask: mid + halfSpread,
    };
  };

  const calculateDuration = (yearsToMaturity: number, coupon: number, yieldRate: number): number => {
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

  const calculateConvexity = (yearsToMaturity: number, coupon: number, yieldRate: number): number => {
    if (yearsToMaturity < 0.5) {
      return yearsToMaturity * yearsToMaturity;
    }
    const n = yearsToMaturity;
    return (n * (n + 1)) / Math.pow(1 + yieldRate / 100, 2);
  };

  const round = (value: number, decimals: number): number => {
    return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
  };

  // Generate initial Treasury securities data
  const generateInitialData = () => {
    const securities: TreasurySecurity[] = [];

    securitiesRef.current.forEach((sec) => {
      const basePrice = sec.basePrice;
      const baseYield = sec.baseYield;
      previousPricesRef.current.set(sec.cusip, basePrice);

      const yearsToMaturity = getYearsToMaturity(sec.maturity);
      const tickSize = 0.03125; // 1/32 of a point
      const spreadTicks = 1 + Math.random() * 2;
      const spread = spreadTicks * tickSize;

      const { bid, ask } = calculateBidAsk(basePrice, spread);
      const duration = calculateDuration(yearsToMaturity, sec.coupon, baseYield);
      const convexity = calculateConvexity(yearsToMaturity, sec.coupon, baseYield);
      const volume = Math.random() * 500 + 50;

      securities.push({
        id: sec.cusip,
        cusip: sec.cusip,
        securityType: sec.securityType,
        maturity: sec.maturity,
        yearsToMaturity: round(yearsToMaturity, 2),
        coupon: sec.coupon,
        price: round(basePrice, 4),
        yield: round(baseYield, 4),
        bid: round(bid, 4),
        ask: round(ask, 4),
        spread: round(spread, 4),
        change: 0,
        changePercent: 0,
        volume: round(volume, 2),
        duration: round(duration, 2),
        convexity: round(convexity, 2),
      });
    });

    setRowData(securities);
  };

  // Update market data for all Treasury securities
  const updateMarketData = () => {
    if (!gridRef.current) return;

    const updatedRows: TreasurySecurity[] = [];

    securitiesRef.current.forEach((sec) => {
      const currentPrice = currentPricesRef.current.get(sec.cusip) || sec.basePrice;
      const currentYield = currentYieldsRef.current.get(sec.cusip) || sec.baseYield;
      const previousPrice = previousPricesRef.current.get(sec.cusip) || sec.basePrice;

      // Random walk price movement
      const change = (Math.random() - 0.5) * 2 * sec.volatility;
      const newPrice = currentPrice + change;
      currentPricesRef.current.set(sec.cusip, newPrice);
      previousPricesRef.current.set(sec.cusip, newPrice);

      // Calculate yield from new price
      const yearsToMaturity = getYearsToMaturity(sec.maturity);
      const newYield = calculateYield(newPrice, sec.coupon, yearsToMaturity);
      currentYieldsRef.current.set(sec.cusip, newYield);

      // Calculate spread
      const tickSize = 0.03125;
      const spreadTicks = 1 + Math.random() * 2;
      const spread = spreadTicks * tickSize;

      const { bid, ask } = calculateBidAsk(newPrice, spread);
      const changeValue = newPrice - sec.basePrice;
      const changePercent = (changeValue / sec.basePrice) * 100;
      const duration = calculateDuration(yearsToMaturity, sec.coupon, newYield);
      const convexity = calculateConvexity(yearsToMaturity, sec.coupon, newYield);
      const volume = Math.random() * 500 + 50;

      updatedRows.push({
        id: sec.cusip,
        cusip: sec.cusip,
        securityType: sec.securityType,
        maturity: sec.maturity,
        yearsToMaturity: round(yearsToMaturity, 2),
        coupon: sec.coupon,
        price: round(newPrice, 4),
        yield: round(newYield, 4),
        bid: round(bid, 4),
        ask: round(ask, 4),
        spread: round(spread, 4),
        change: round(changeValue, 4),
        changePercent: round(changePercent, 4),
        volume: round(volume, 2),
        duration: round(duration, 2),
        convexity: round(convexity, 2),
      });
    });

    // Update rows using RxJS subject
    gridRef.current.updateRows$.next(updatedRows);
  };

  useEffect(() => {
    // Initialize current prices and yields
    securitiesRef.current.forEach((sec) => {
      currentPricesRef.current.set(sec.cusip, sec.basePrice);
      currentYieldsRef.current.set(sec.cusip, sec.baseYield);
      previousPricesRef.current.set(sec.cusip, sec.basePrice);
    });

    logger.info('Treasury Market Data component initialized');

    // Generate initial Treasury securities data
    generateInitialData();
  }, []);

  // Restore saved grid state when ready
  useEffect(() => {
    if (isRestored && savedState['agGrid'] && gridRef.current) {
      gridRef.current.applyGridState(savedState['agGrid'] as GridState);
      logger.info('Restored grid state from workspace snapshot');
    }
  }, [isRestored]);

  // Auto-save grid state every 5 seconds
  useEffect(() => {
    viewState.enableAutoSave(() => ({
      agGrid: gridRef.current?.getGridState(),
    }));
    return () => viewState.disableAutoSave();
  }, [viewState]);

  // Treasury Market Data Columns
  // Note: Using array instead of JSON string to preserve function references (valueFormatter, cellStyle)
  const columns = useMemo(
    () => [
      { field: 'cusip', headerName: 'CUSIP', width: 120, pinned: 'left' as const },
      { field: 'securityType', headerName: 'Type', width: 100 },
      { field: 'maturity', headerName: 'Maturity', width: 120 },
      { field: 'yearsToMaturity', headerName: 'YTM', width: 100, valueFormatter: (params: any) => params.value.toFixed(2) },
      { field: 'coupon', headerName: 'Coupon', width: 100, valueFormatter: (params: any) => `${params.value.toFixed(2)}%` },
      {
        field: 'price',
        headerName: 'Price',
        width: 120,
        valueFormatter: (params: any) => formatTreasury32nd(params.value),
        cellStyle: { textAlign: 'right' }
      },
      {
        field: 'yield',
        headerName: 'Yield',
        width: 120,
        valueFormatter: (params: any) => `${params.value.toFixed(4)}%`,
        cellStyle: { textAlign: 'right' }
      },
      {
        field: 'bid',
        headerName: 'Bid',
        width: 120,
        valueFormatter: (params: any) => formatTreasury32nd(params.value),
        cellStyle: { textAlign: 'right' }
      },
      {
        field: 'ask',
        headerName: 'Ask',
        width: 120,
        valueFormatter: (params: any) => formatTreasury32nd(params.value),
        cellStyle: { textAlign: 'right' }
      },
      {
        field: 'spread',
        headerName: 'Spread',
        width: 100,
        valueFormatter: (params: any) => params.value.toFixed(4),
        cellStyle: { textAlign: 'right' }
      },
      {
        field: 'change',
        headerName: 'Change',
        width: 120,
        valueFormatter: (params: any) => `${params.value >= 0 ? '+' : ''}${params.value.toFixed(4)}`,
        cellStyle: (params: any) => {
          if (params.value > 0) return { color: 'green', textAlign: 'right' };
          if (params.value < 0) return { color: 'red', textAlign: 'right' };
          return { textAlign: 'right' };
        }
      },
      {
        field: 'changePercent',
        headerName: 'Change %',
        width: 120,
        valueFormatter: (params: any) => `${params.value >= 0 ? '+' : ''}${params.value.toFixed(4)}%`,
        cellStyle: (params: any) => {
          if (params.value > 0) return { color: 'green', textAlign: 'right' };
          if (params.value < 0) return { color: 'red', textAlign: 'right' };
          return { textAlign: 'right' };
        }
      },
      {
        field: 'volume',
        headerName: 'Volume',
        width: 120,
        valueFormatter: (params: any) => `${params.value.toFixed(2)}M`,
        cellStyle: { textAlign: 'right' }
      },
      {
        field: 'duration',
        headerName: 'Duration',
        width: 120,
        valueFormatter: (params: any) => params.value.toFixed(2),
        cellStyle: { textAlign: 'right' }
      },
      {
        field: 'convexity',
        headerName: 'Convexity',
        width: 120,
        valueFormatter: (params: any) => params.value.toFixed(2),
        cellStyle: { textAlign: 'right' }
      },
    ],
    []
  );

  // Initial row data (empty, will be populated)
  const [rowData, setRowData] = useState<TreasurySecurity[]>([]);

  // getRowId function to track rows by CUSIP
  const getRowId = useMemo(() => (params: GetRowIdParams): string => {
    return params.data.id;
  }, []);

  // Start market data updates every 1 second
  useEffect(() => {
    if (rowData.length === 0 || !gridRef.current) return;

    // Add initial rows using RxJS subject
    gridRef.current.addRows$.next(rowData);
    logger.info('Initial Treasury securities loaded', { count: rowData.length });

    // Start simulating market data updates every 1 second
    const interval = setInterval(() => {
      updateMarketData();
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [rowData.length]);

  return (
    <>
      <h1 className="text-2xl font-bold mb-4">On-The-Run Treasury Market Data</h1>
      <div style={{ height: 'calc(100vh - 100px)', width: '100%' }}>
        <MacroReactGrid
          ref={gridRef}
          columns={columns}
          rowData={rowData}
          getRowId={getRowId}
        />
      </div>
    </>
  );
}

export default TreasuryMarketDataComponent;

