import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';

// Capture props passed to MacroReactGrid
let capturedGridProps: any = null;

// Mock external dependencies before importing the component
vi.mock('@macro/logger', () => ({
  Logger: {
    getLogger: () => ({
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      setLevel: vi.fn(),
      getLevel: vi.fn(),
    }),
    setGlobalLevel: vi.fn(),
    getGlobalLevel: vi.fn(),
  },
  LogLevel: { DEBUG: 'debug', INFO: 'info', WARN: 'warn', ERROR: 'error' },
}));

vi.mock('@macro/macro-react-grid', () => ({
  MacroReactGrid: vi.fn().mockImplementation((props: any) => {
    capturedGridProps = props;
    return <div data-testid="macro-react-grid">Mock Grid</div>;
  }),
}));

vi.mock('@macro/openfin/react', () => ({
  useViewState: () => [
    { enableAutoSave: vi.fn(), disableAutoSave: vi.fn() },
    {},
    false,
  ],
}));

vi.mock('ag-grid-community', () => ({
  GetRowIdParams: {},
  GridState: {},
}));

import { TreasuryMarketDataComponent } from './treasury-market-data.component';

describe('TreasuryMarketDataComponent', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    capturedGridProps = null;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should render the component title', () => {
    render(<TreasuryMarketDataComponent />);
    expect(screen.getByText('On-The-Run Treasury Market Data')).toBeTruthy();
  });

  it('should render the AG Grid component', () => {
    render(<TreasuryMarketDataComponent />);
    expect(screen.getByTestId('macro-react-grid')).toBeTruthy();
  });

  it('should render the heading as h1', () => {
    const { container } = render(<TreasuryMarketDataComponent />);
    const h1 = container.querySelector('h1');
    expect(h1).toBeTruthy();
    expect(h1?.textContent).toBe('On-The-Run Treasury Market Data');
  });

  it('should have proper layout structure', () => {
    const { container } = render(<TreasuryMarketDataComponent />);
    const gridContainer = container.querySelector('div[style]');
    expect(gridContainer).toBeTruthy();
  });

  it('should pass column definitions to the grid', () => {
    render(<TreasuryMarketDataComponent />);
    expect(capturedGridProps).toBeTruthy();
    expect(capturedGridProps.columns).toBeDefined();
    expect(capturedGridProps.columns.length).toBeGreaterThan(0);
  });

  it('should define expected column fields', () => {
    render(<TreasuryMarketDataComponent />);
    const fields = capturedGridProps.columns.map((c: any) => c.field);
    expect(fields).toContain('cusip');
    expect(fields).toContain('securityType');
    expect(fields).toContain('maturity');
    expect(fields).toContain('yearsToMaturity');
    expect(fields).toContain('coupon');
    expect(fields).toContain('price');
    expect(fields).toContain('yield');
    expect(fields).toContain('bid');
    expect(fields).toContain('ask');
    expect(fields).toContain('spread');
    expect(fields).toContain('change');
    expect(fields).toContain('changePercent');
    expect(fields).toContain('volume');
    expect(fields).toContain('duration');
    expect(fields).toContain('convexity');
  });

  it('should pin CUSIP column to the left', () => {
    render(<TreasuryMarketDataComponent />);
    const cusipCol = capturedGridProps.columns.find((c: any) => c.field === 'cusip');
    expect(cusipCol.pinned).toBe('left');
  });

  it('should pass a getRowId function to the grid', () => {
    render(<TreasuryMarketDataComponent />);
    expect(capturedGridProps.getRowId).toBeDefined();
    expect(typeof capturedGridProps.getRowId).toBe('function');
  });

  it('should return the id from getRowId', () => {
    render(<TreasuryMarketDataComponent />);
    const result = capturedGridProps.getRowId({ data: { id: 'TEST-123' } });
    expect(result).toBe('TEST-123');
  });

  it('should generate initial row data with 11 securities', () => {
    render(<TreasuryMarketDataComponent />);
    expect(capturedGridProps.rowData).toBeDefined();
    expect(capturedGridProps.rowData.length).toBe(11);
  });

  it('should have T-Bill, T-Note, and T-Bond types in row data', () => {
    render(<TreasuryMarketDataComponent />);
    const types = [...new Set(capturedGridProps.rowData.map((r: any) => r.securityType))];
    expect(types).toContain('T-Bill');
    expect(types).toContain('T-Note');
    expect(types).toContain('T-Bond');
  });

  it('should format coupon column with percentage', () => {
    render(<TreasuryMarketDataComponent />);
    const couponCol = capturedGridProps.columns.find((c: any) => c.field === 'coupon');
    expect(couponCol.valueFormatter({ value: 4.25 })).toBe('4.25%');
  });

  it('should format yield column with percentage and 4 decimals', () => {
    render(<TreasuryMarketDataComponent />);
    const yieldCol = capturedGridProps.columns.find((c: any) => c.field === 'yield');
    expect(yieldCol.valueFormatter({ value: 4.1234 })).toBe('4.1234%');
  });

  it('should format price column using Treasury 32nd notation', () => {
    render(<TreasuryMarketDataComponent />);
    const priceCol = capturedGridProps.columns.find((c: any) => c.field === 'price');
    // 99.5 -> handle=99, 0.5*32=16 -> "99-16"
    expect(priceCol.valueFormatter({ value: 99.5 })).toBe('99-16');
  });

  it('should format bid column using Treasury 32nd notation', () => {
    render(<TreasuryMarketDataComponent />);
    const bidCol = capturedGridProps.columns.find((c: any) => c.field === 'bid');
    expect(bidCol.valueFormatter({ value: 100.25 })).toBe('100-08');
  });

  it('should format ask column using Treasury 32nd notation', () => {
    render(<TreasuryMarketDataComponent />);
    const askCol = capturedGridProps.columns.find((c: any) => c.field === 'ask');
    expect(askCol.valueFormatter({ value: 100.75 })).toBe('100-24');
  });

  it('should format change column with sign prefix', () => {
    render(<TreasuryMarketDataComponent />);
    const changeCol = capturedGridProps.columns.find((c: any) => c.field === 'change');
    expect(changeCol.valueFormatter({ value: 0.1234 })).toBe('+0.1234');
    expect(changeCol.valueFormatter({ value: -0.5678 })).toBe('-0.5678');
    expect(changeCol.valueFormatter({ value: 0 })).toBe('+0.0000');
  });

  it('should format changePercent column with sign and %', () => {
    render(<TreasuryMarketDataComponent />);
    const changePctCol = capturedGridProps.columns.find((c: any) => c.field === 'changePercent');
    expect(changePctCol.valueFormatter({ value: 1.5 })).toBe('+1.5000%');
    expect(changePctCol.valueFormatter({ value: -0.25 })).toBe('-0.2500%');
  });

  it('should format volume with M suffix', () => {
    render(<TreasuryMarketDataComponent />);
    const volumeCol = capturedGridProps.columns.find((c: any) => c.field === 'volume');
    expect(volumeCol.valueFormatter({ value: 123.45 })).toBe('123.45M');
  });

  it('should format YTM with 2 decimal places', () => {
    render(<TreasuryMarketDataComponent />);
    const ytmCol = capturedGridProps.columns.find((c: any) => c.field === 'yearsToMaturity');
    expect(ytmCol.valueFormatter({ value: 5.1234 })).toBe('5.12');
  });

  it('should format spread with 4 decimal places', () => {
    render(<TreasuryMarketDataComponent />);
    const spreadCol = capturedGridProps.columns.find((c: any) => c.field === 'spread');
    expect(spreadCol.valueFormatter({ value: 0.03125 })).toBe('0.0313');
  });

  it('should format duration with 2 decimal places', () => {
    render(<TreasuryMarketDataComponent />);
    const durationCol = capturedGridProps.columns.find((c: any) => c.field === 'duration');
    expect(durationCol.valueFormatter({ value: 7.8912 })).toBe('7.89');
  });

  it('should format convexity with 2 decimal places', () => {
    render(<TreasuryMarketDataComponent />);
    const convexityCol = capturedGridProps.columns.find((c: any) => c.field === 'convexity');
    expect(convexityCol.valueFormatter({ value: 101.234 })).toBe('101.23');
  });

  it('should apply green color style for positive change', () => {
    render(<TreasuryMarketDataComponent />);
    const changeCol = capturedGridProps.columns.find((c: any) => c.field === 'change');
    const style = changeCol.cellStyle({ value: 0.5 });
    expect(style.color).toBe('green');
  });

  it('should apply red color style for negative change', () => {
    render(<TreasuryMarketDataComponent />);
    const changeCol = capturedGridProps.columns.find((c: any) => c.field === 'change');
    const style = changeCol.cellStyle({ value: -0.3 });
    expect(style.color).toBe('red');
  });

  it('should apply no color for zero change', () => {
    render(<TreasuryMarketDataComponent />);
    const changeCol = capturedGridProps.columns.find((c: any) => c.field === 'change');
    const style = changeCol.cellStyle({ value: 0 });
    expect(style.color).toBeUndefined();
    expect(style.textAlign).toBe('right');
  });

  it('should apply green color style for positive changePercent', () => {
    render(<TreasuryMarketDataComponent />);
    const changePctCol = capturedGridProps.columns.find((c: any) => c.field === 'changePercent');
    const style = changePctCol.cellStyle({ value: 1.5 });
    expect(style.color).toBe('green');
  });

  it('should apply red color style for negative changePercent', () => {
    render(<TreasuryMarketDataComponent />);
    const changePctCol = capturedGridProps.columns.find((c: any) => c.field === 'changePercent');
    const style = changePctCol.cellStyle({ value: -0.3 });
    expect(style.color).toBe('red');
  });

  it('should initialize all securities with zero change', () => {
    render(<TreasuryMarketDataComponent />);
    capturedGridProps.rowData.forEach((row: any) => {
      expect(row.change).toBe(0);
      expect(row.changePercent).toBe(0);
    });
  });

  it('should have 3 T-Bills in initial data', () => {
    render(<TreasuryMarketDataComponent />);
    const bills = capturedGridProps.rowData.filter((r: any) => r.securityType === 'T-Bill');
    expect(bills.length).toBe(3);
  });

  it('should have 6 T-Notes in initial data', () => {
    render(<TreasuryMarketDataComponent />);
    const notes = capturedGridProps.rowData.filter((r: any) => r.securityType === 'T-Note');
    expect(notes.length).toBe(6);
  });

  it('should have 2 T-Bonds in initial data', () => {
    render(<TreasuryMarketDataComponent />);
    const bonds = capturedGridProps.rowData.filter((r: any) => r.securityType === 'T-Bond');
    expect(bonds.length).toBe(2);
  });

  it('should have T-Bills with zero coupon', () => {
    render(<TreasuryMarketDataComponent />);
    const bills = capturedGridProps.rowData.filter((r: any) => r.securityType === 'T-Bill');
    bills.forEach((bill: any) => {
      expect(bill.coupon).toBe(0);
    });
  });
});
