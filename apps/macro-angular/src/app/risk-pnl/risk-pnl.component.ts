import { Component, ViewChild, AfterViewInit, OnDestroy, inject, ChangeDetectionStrategy } from '@angular/core';
import { Logger } from '@macro/logger';
import { MacroAngularGrid } from '@macro/macro-angular-grid';
import { ViewStateService } from '@macro/openfin';
import type { ColumnFormatMap } from '@macro/macro-grid-format';
import { ColDef, GetRowIdParams, GridOptions, GridState } from 'ag-grid-community';

/** One position/risk record — the leaf row, grouped by desk → book → trader. */
interface RiskPosition {
  id: string;
  desk: string;
  book: string;
  trader: string;
  instrument: string;
  pnl: number; // total/MTD PnL ($)
  dayPnl: number; // today's PnL ($)
  dv01: number; // rates risk ($ per bp)
  notional: number; // gross notional ($)
}

/** Desk → book → trader org structure used to fabricate the book of risk. */
const STRUCTURE: Record<string, Record<string, string[]>> = {
  Rates: { 'USD Swaps': ['A. Patel', 'M. Chen'], 'EUR Govvies': ['L. Rossi'], 'UST Cash': ['J. Smith', 'K. Olsen'] },
  FX: { 'G10 Spot': ['S. Khan', 'R. Diaz'], 'EM FX': ['T. Mori'], 'FX Options': ['P. Novak'] },
  Credit: { 'IG Cash': ['D. Lee'], 'HY Cash': ['B. Ahmed', 'C. Vance'], CDS: ['F. Mueller'] },
  Commodities: { Energy: ['G. Park'], Metals: ['H. Costa'] },
};

const INSTRUMENTS: Record<string, string[]> = {
  Rates: ['UST 2Y', 'UST 10Y', 'USD IRS 5Y', 'EU 10Y', 'UST 30Y'],
  FX: ['EURUSD', 'GBPUSD', 'USDJPY', 'EURJPY', 'AUDUSD'],
  Credit: ['IG Index', 'HY Index', 'XYZ 5Y CDS', 'ABC 10Y'],
  Commodities: ['WTI', 'Brent', 'Gold', 'Copper'],
};

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const round0 = (n: number) => Math.round(n);

/**
 * Risk / PnL dashboard — positions grouped by Desk → Book → Trader, with summed PnL / DV01 /
 * Notional aggregations and AG Grid 36 "Show Values As" columns (each group's contribution as a
 * % of the grand total / parent total). Demonstrates row grouping + aggregation + Show Values As,
 * all persisted via the workspace ViewState snapshot.
 */
@Component({
  selector: 'app-risk-pnl',
  templateUrl: './risk-pnl.component.html',
  styleUrl: './risk-pnl.component.css',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [MacroAngularGrid],
})
export class RiskPnlComponent implements AfterViewInit, OnDestroy {
  private logger = Logger.getLogger('RiskPnlComponent');
  private viewState = inject(ViewStateService);

  @ViewChild(MacroAngularGrid) gridComponent!: MacroAngularGrid;

  public columns: ColDef[] = [
    // Grouping hierarchy (hidden — rendered by the auto group column).
    { field: 'desk', rowGroup: true, hide: true },
    { field: 'book', rowGroup: true, hide: true },
    { field: 'trader', rowGroup: true, hide: true },

    { field: 'instrument', headerName: 'Instrument', minWidth: 150 },

    // Aggregated metrics (sum), formatted via the Format panel (see initialColumnFormats).
    { field: 'pnl', headerName: 'PnL', aggFunc: 'sum', enableValue: true, type: 'numericColumn',
      cellStyle: { textAlign: 'right' }, width: 150 },
    { field: 'dayPnl', headerName: 'Day PnL', aggFunc: 'sum', enableValue: true, type: 'numericColumn',
      cellStyle: { textAlign: 'right' }, width: 140 },
    { field: 'dv01', headerName: 'DV01', aggFunc: 'sum', enableValue: true, type: 'numericColumn',
      cellStyle: { textAlign: 'right' }, width: 130 },
    { field: 'notional', headerName: 'Notional', aggFunc: 'sum', enableValue: true, type: 'numericColumn',
      cellStyle: { textAlign: 'right' }, width: 150 },

    // "Show Values As" columns (AG Grid 36 Enterprise): contribution as a % of a total. Each row's
    // aggregated value is shown relative to a total; users can change the mode from the column menu.
    {
      colId: 'pnlPctGrand', field: 'pnl', headerName: 'PnL % (grand)', aggFunc: 'sum',
      showValuesAs: 'percentOfGrandTotal', enableShowValuesAs: true, type: 'numericColumn',
      cellStyle: { textAlign: 'right' }, width: 140,
    },
    {
      colId: 'notionalPctParent', field: 'notional', headerName: 'Notional % (parent)', aggFunc: 'sum',
      showValuesAs: 'percentOfParentRowTotal', enableShowValuesAs: true, type: 'numericColumn',
      cellStyle: { textAlign: 'right' }, width: 170,
    },
  ];

  /** Seed capital-markets formats on the absolute metric columns (the % columns are left to Show Values As). */
  public initialColumnFormats: ColumnFormatMap = {
    pnl: { kind: 'currency', currency: 'USD', decimals: 0, negativeStyle: 'parentheses', colorMode: 'posneg' },
    dayPnl: { kind: 'currency', currency: 'USD', decimals: 0, negativeStyle: 'parentheses', colorMode: 'posneg' },
    dv01: { kind: 'currency', currency: 'USD', decimals: 0 },
    notional: { kind: 'compact', notation: 'mmbn', decimals: 1, prefix: '$' },
  };

  public gridOptions: GridOptions = {
    rowGroupPanelShow: 'always',
    groupDefaultExpanded: 1,
    grandTotalRow: 'bottom',
    suppressAggFuncInHeader: true,
    autoGroupColumnDef: {
      headerName: 'Desk / Book / Trader',
      minWidth: 260,
      pinned: 'left',
      cellRendererParams: { suppressCount: false },
    },
  };

  public rowData: RiskPosition[] = [];
  private initialData: RiskPosition[] = [];

  public getRowId = (params: GetRowIdParams): string => params.data.id;

  private updateInterval?: number;

  constructor() {
    this.initialData = this.generatePositions();
  }

  async ngAfterViewInit(): Promise<void> {
    this.gridComponent.setInitialRowData(this.initialData);
    this.logger.info('Risk/PnL positions loaded', { count: this.initialData.length });

    // Restore any previously saved grid state (grouping, sort, Show Values As selections, formats).
    const saved = await this.viewState.restoreState();
    if (saved['agGrid']) {
      this.gridComponent.applyGridState(saved['agGrid'] as GridState);
      this.logger.info('Restored Risk/PnL grid state from workspace snapshot');
    }

    // Persist grid state (incl. grouping + Show Values As + formats) on workspace save.
    this.viewState.setCollector(() => ({ agGrid: this.gridComponent.getGridState() }));

    // Gentle live PnL ticks so the aggregations + % contributions update in real time.
    this.updateInterval = window.setInterval(() => this.tickPnl(), 2500);
  }

  ngOnDestroy(): void {
    this.viewState.destroy();
    if (this.updateInterval) clearInterval(this.updateInterval);
  }

  /** Nudge PnL on a random subset of positions; the grid re-aggregates the groups. */
  private tickPnl(): void {
    const updates: RiskPosition[] = [];
    for (const pos of this.initialData) {
      if (Math.random() > 0.18) continue;
      const move = rand(-1, 1) * Math.max(2000, Math.abs(pos.notional) * 0.0001);
      pos.dayPnl = round0(pos.dayPnl + move);
      pos.pnl = round0(pos.pnl + move);
      updates.push({ ...pos });
    }
    if (updates.length) this.gridComponent.updateRows$.next(updates);
  }

  private generatePositions(): RiskPosition[] {
    const rows: RiskPosition[] = [];
    for (const [desk, books] of Object.entries(STRUCTURE)) {
      const instruments = INSTRUMENTS[desk];
      for (const [book, traders] of Object.entries(books)) {
        for (const trader of traders) {
          const n = Math.floor(rand(2, 5)); // 2–4 positions per trader
          for (let i = 0; i < n; i++) {
            const instrument = instruments[Math.floor(rand(0, instruments.length))];
            rows.push({
              id: `${desk}|${book}|${trader}|${instrument}|${i}`,
              desk,
              book,
              trader,
              instrument,
              pnl: round0(rand(-650_000, 900_000)),
              dayPnl: round0(rand(-120_000, 150_000)),
              dv01: round0(rand(0, 180_000)),
              notional: round0(rand(2_000_000, 220_000_000)),
            });
          }
        }
      }
    }
    return rows;
  }
}
