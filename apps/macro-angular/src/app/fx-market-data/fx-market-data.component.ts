import { Component, OnInit, ViewChild, AfterViewInit, OnDestroy, inject } from '@angular/core';
import { Logger } from '@macro/logger';
import { MacroAngularGrid } from '@macro/macro-angular-grid';
import { ViewStateService } from '@macro/openfin';
import { GetRowIdParams, ColDef, CellStyle, GridState } from 'ag-grid-community';

interface CurrencyPair {
  id: string;
  symbol: string;
  base: string;
  quote: string;
  bid: number;
  ask: number;
  mid: number;
  spread: number;
  change: number;
  changePercent: number;
}

@Component({
  selector: 'app-fx-market-data',
  templateUrl: './fx-market-data.component.html',
  styleUrl: './fx-market-data.component.css',
  standalone: true,
  imports: [MacroAngularGrid],
})
export class FxMarketDataComponent implements OnInit, AfterViewInit, OnDestroy {
  private logger = Logger.getLogger('FxMarketDataComponent');
  private viewState = inject(ViewStateService);

  @ViewChild(MacroAngularGrid) gridComponent!: MacroAngularGrid;

  // FX Market Data Columns - Using array instead of JSON string to preserve functions
  public columns: ColDef[] = [
    { field: 'symbol', headerName: 'Symbol', width: 120, pinned: 'left' },
    { field: 'base', headerName: 'Base', width: 80 },
    { field: 'quote', headerName: 'Quote', width: 80 },
    { 
      field: 'bid', 
      headerName: 'Bid', 
      width: 120,
      valueFormatter: (params: any) => this.formatPrice(params.value, params.data.symbol),
      cellStyle: { textAlign: 'right' }
    },
    { 
      field: 'ask', 
      headerName: 'Ask', 
      width: 120,
      valueFormatter: (params: any) => this.formatPrice(params.value, params.data.symbol),
      cellStyle: { textAlign: 'right' }
    },
    { 
      field: 'mid', 
      headerName: 'Mid', 
      width: 120,
      valueFormatter: (params: any) => this.formatPrice(params.value, params.data.symbol),
      cellStyle: { textAlign: 'right' }
    },
    { 
      field: 'spread', 
      headerName: 'Spread', 
      width: 100,
      valueFormatter: (params: any) => this.formatSpread(params.value, params.data.symbol),
      cellStyle: { textAlign: 'right' }
    },
    { 
      field: 'change', 
      headerName: 'Change', 
      width: 120,
      valueFormatter: (params: any) => this.formatChange(params.value, params.data.symbol),
      cellStyle: (params: any): CellStyle => {
        const style: CellStyle = { textAlign: 'right' };
        if (params.value > 0) {
          style['color'] = 'green';
        } else if (params.value < 0) {
          style['color'] = 'red';
        }
        return style;
      }
    },
    { 
      field: 'changePercent', 
      headerName: 'Change %', 
      width: 120,
      valueFormatter: (params: any) => `${params.value >= 0 ? '+' : ''}${params.value.toFixed(4)}%`,
      cellStyle: (params: any): CellStyle => {
        const style: CellStyle = { textAlign: 'right' };
        if (params.value > 0) {
          style['color'] = 'green';
        } else if (params.value < 0) {
          style['color'] = 'red';
        }
        return style;
      }
    },
  ];

  // Initial row data (empty, will be populated via transactions)
  public rowData: CurrencyPair[] = [];

  // Store initial data separately to avoid duplicate binding
  private initialData: CurrencyPair[] = [];

  // getRowId function to track rows by symbol
  public getRowId = (params: GetRowIdParams): string => {
    return params.data.id;
  };

  // FX Market Data state
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

  private previousRates: Map<string, number> = new Map();
  private updateInterval?: number;

  ngOnInit(): void {
    this.logger.info('FX Market Data component initialized');
    
    // Generate initial G10 currency pairs (store in initialData, not rowData)
    this.generateInitialData();
  }

  async ngAfterViewInit(): Promise<void> {
    this.logger.info('Grid component ready', { gridApi: this.gridComponent.getGridApi() });

    // Set initial data using the safe method that handles grid readiness
    this.gridComponent.setInitialRowData(this.initialData);
    this.logger.info('Initial G10 currency pairs queued/loaded', { count: this.initialData.length });

    // Restore any previously saved grid state (column order, filters, sort, etc.)
    const saved = await this.viewState.restoreState();
    if (saved['agGrid']) {
      this.gridComponent.applyGridState(saved['agGrid'] as GridState);
      this.logger.info('Restored grid state from workspace snapshot');
    }

    // Auto-save grid state every 5 seconds so workspace save captures it
    this.viewState.enableAutoSave(() => ({
      agGrid: this.gridComponent.getGridState(),
    }));

    // Start simulating market data updates every 1 second
    this.startMarketDataUpdates();
  }

  ngOnDestroy(): void {
    this.viewState.destroy();
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    this.logger.info('FX Market Data component destroyed');
  }

  /**
   * Generate initial G10 currency pairs data
   */
  private generateInitialData(): void {
    const pairs: CurrencyPair[] = [];

    for (const [symbol, baseRate] of this.baseRates.entries()) {
      const mid = baseRate;
      this.previousRates.set(symbol, mid);

      const isJPY = symbol.includes('JPY');
      const pipSize = isJPY ? 0.01 : 0.0001;
      const spreadPips = 1 + Math.random() * 4;
      const spread = spreadPips * pipSize;

      const { bid, ask } = this.calculateBidAsk(mid, spread);

      pairs.push({
        id: symbol,
        symbol,
        base: symbol.substring(0, 3),
        quote: symbol.substring(3),
        bid: this.round(bid, isJPY ? 2 : 5),
        ask: this.round(ask, isJPY ? 2 : 5),
        mid: this.round(mid, isJPY ? 2 : 5),
        spread: this.round(spread, isJPY ? 2 : 5),
        change: 0,
        changePercent: 0,
      });
    }

    // Store in initialData instead of rowData to avoid duplicate binding
    this.initialData = pairs;
  }

  /**
   * Start market data updates every 1 second
   */
  private startMarketDataUpdates(): void {
    this.updateInterval = window.setInterval(() => {
      this.updateMarketData();
    }, 1000);
  }


  
  /**
   * Update market data for all currency pairs
   */
  private updateMarketData(): void {
    const updatedRows: CurrencyPair[] = [];

    for (const [symbol, baseRate] of this.baseRates.entries()) {
      const vol = this.volatility.get(symbol) || 0.001;
      const previousRate = this.previousRates.get(symbol) || baseRate;

      // Random walk price movement
      const change = (Math.random() - 0.5) * 2 * vol;
      const newMid = previousRate + change;
      this.baseRates.set(symbol, newMid);
      this.previousRates.set(symbol, newMid);

      const isJPY = symbol.includes('JPY');
      const pipSize = isJPY ? 0.01 : 0.0001;
      const spreadPips = 1 + Math.random() * 4;
      const spread = spreadPips * pipSize;

      const { bid, ask } = this.calculateBidAsk(newMid, spread);
      const changeValue = newMid - baseRate;
      const changePercent = (changeValue / baseRate) * 100;

      updatedRows.push({
        id: symbol,
        symbol,
        base: symbol.substring(0, 3),
        quote: symbol.substring(3),
        bid: this.round(bid, isJPY ? 2 : 5),
        ask: this.round(ask, isJPY ? 2 : 5),
        mid: this.round(newMid, isJPY ? 2 : 5),
        spread: this.round(spread, isJPY ? 2 : 5),
        change: this.round(changeValue, isJPY ? 2 : 5),
        changePercent: this.round(changePercent, 4),
      });
    }

    // Update rows using RxJS subject
    this.gridComponent.updateRows$.next(updatedRows);
  }

  /**
   * Calculate bid/ask from mid price and spread
   */
  private calculateBidAsk(mid: number, spread: number): { bid: number; ask: number } {
    const halfSpread = spread / 2;
    return {
      bid: mid - halfSpread,
      ask: mid + halfSpread,
    };
  }

  /**
   * Round to specified decimal places
   */
  private round(value: number, decimals: number): number {
    return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
  }

  /**
   * Format price for display
   */
  private formatPrice(value: number, symbol: string): string {
    const isJPY = symbol.includes('JPY');
    const decimals = isJPY ? 2 : 5;
    return value.toFixed(decimals);
  }

  /**
   * Format spread for display
   */
  private formatSpread(value: number, symbol: string): string {
    const isJPY = symbol.includes('JPY');
    const decimals = isJPY ? 2 : 5;
    return value.toFixed(decimals);
  }

  /**
   * Format change for display
   */
  private formatChange(value: number, symbol: string): string {
    const isJPY = symbol.includes('JPY');
    const decimals = isJPY ? 2 : 5;
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(decimals)}`;
  }
}

