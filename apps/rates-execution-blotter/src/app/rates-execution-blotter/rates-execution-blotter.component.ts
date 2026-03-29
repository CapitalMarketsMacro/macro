import { Component, OnInit, OnDestroy, ViewChild, signal, inject } from '@angular/core';
import { MacroAngularGrid } from '@macro/macro-angular-grid';
import { AmpsTransportService } from '@macro/transports/angular';
import { ConflationSubject } from '@macro/rxutils';
import { Logger } from '@macro/logger';
import type { TransportMessage } from '@macro/transports';
import type { ColDef } from 'ag-grid-community';

const logger = Logger.getLogger('RatesExecutionBlotterComponent');

interface DataRow {
  clientKey: number;
  DeskId: number;
  DstEE: string;
  ExchangeExecutionId: string;
  ExecutedQty: number;
  ExecutionId: number;
  ExecutionIdString: string;
  LeavesQty: number;
  OrderId: number;
  OrderIdString: string;
  ParentOrderId: number;
  ParentOrderIdString: string;
  Price: number;
  AlgoAccountId: number;
  ExecAccountId: number;
  ProductId: number;
  PublishTime: number;
  PublishTimeFormatted: string;
  Qty: number;
  Side: string;
  clmmStrategy: string;
  TransactionTime: number;
  UserId: string;
  Comment: string;
  updatedTime: number;
  CounterParty: string;
  Venue: string;
  TransactTime: number;
  SendingTime: number;
  LineHandlerTimeStamp: number;
  _rowId: string;
}

@Component({
  selector: 'app-rates-execution-blotter',
  standalone: true,
  imports: [MacroAngularGrid],
  templateUrl: './rates-execution-blotter.component.html',
  styleUrl: './rates-execution-blotter.component.css',
})
export class RatesExecutionBlotterComponent implements OnInit, OnDestroy {
  private transport = inject(AmpsTransportService);
  @ViewChild(MacroAngularGrid) grid!: MacroAngularGrid;

  readonly connected = signal(false);
  readonly messageCount = signal(0);
  readonly error = signal<string | null>(null);

  readonly ampsUrl = 'ws://montunoblenumbat2404:9008/amps/json';
  readonly topic = 'rates/executions';

  columns: ColDef[] = [
    {
      field: 'clientKey',
      headerName: 'Client Key',
      type: 'numericColumn',
      cellStyle: { textAlign: 'right' },
      allowFormula: true,
      valueFormatter: (p: any) => p.value != null ? p.value.toLocaleString() : '',
    },
    {
      field: 'DeskId',
      headerName: 'Desk Id',
      type: 'numericColumn',
      cellStyle: { textAlign: 'right' },
      allowFormula: true,
      valueFormatter: (p: any) => p.value != null ? p.value.toLocaleString() : '',
    },
    {
      field: 'DstEE',
      headerName: 'Dst E E',
    },
    {
      field: 'ExchangeExecutionId',
      headerName: 'Exchange Execution Id',
    },
    {
      field: 'ExecutedQty',
      headerName: 'Executed Qty',
      type: 'numericColumn',
      cellStyle: { textAlign: 'right' },
      allowFormula: true,
      valueFormatter: (p: any) => p.value != null ? p.value.toLocaleString() : '',
    },
    {
      field: 'ExecutionId',
      headerName: 'Execution Id',
      type: 'numericColumn',
      cellStyle: { textAlign: 'right' },
      allowFormula: true,
      valueFormatter: (p: any) => p.value != null ? p.value.toLocaleString() : '',
    },
    {
      field: 'ExecutionIdString',
      headerName: 'Execution Id String',
    },
    {
      field: 'LeavesQty',
      headerName: 'Leaves Qty',
      type: 'numericColumn',
      cellStyle: { textAlign: 'right' },
      allowFormula: true,
      valueFormatter: (p: any) => p.value != null ? p.value.toLocaleString() : '',
    },
    {
      field: 'OrderId',
      headerName: 'Order Id',
      type: 'numericColumn',
      cellStyle: { textAlign: 'right' },
      allowFormula: true,
      valueFormatter: (p: any) => p.value != null ? p.value.toLocaleString() : '',
    },
    {
      field: 'OrderIdString',
      headerName: 'Order Id String',
    },
    {
      field: 'ParentOrderId',
      headerName: 'Parent Order Id',
      type: 'numericColumn',
      cellStyle: { textAlign: 'right' },
      allowFormula: true,
      valueFormatter: (p: any) => p.value != null ? p.value.toLocaleString() : '',
    },
    {
      field: 'ParentOrderIdString',
      headerName: 'Parent Order Id String',
    },
    {
      field: 'Price',
      headerName: 'Price',
      type: 'numericColumn',
      cellStyle: { textAlign: 'right' },
      allowFormula: true,
      valueFormatter: (p: any) => p.value != null ? p.value.toFixed(8) : '',
    },
    {
      field: 'AlgoAccountId',
      headerName: 'Algo Account Id',
      type: 'numericColumn',
      cellStyle: { textAlign: 'right' },
      allowFormula: true,
      valueFormatter: (p: any) => p.value != null ? p.value.toLocaleString() : '',
    },
    {
      field: 'ExecAccountId',
      headerName: 'Exec Account Id',
      type: 'numericColumn',
      cellStyle: { textAlign: 'right' },
      allowFormula: true,
      valueFormatter: (p: any) => p.value != null ? p.value.toLocaleString() : '',
    },
    {
      field: 'ProductId',
      headerName: 'Product Id',
      type: 'numericColumn',
      cellStyle: { textAlign: 'right' },
      allowFormula: true,
      valueFormatter: (p: any) => p.value != null ? p.value.toLocaleString() : '',
    },
    {
      field: 'PublishTime',
      headerName: 'Publish Time',
      type: 'numericColumn',
      cellStyle: { textAlign: 'right' },
      allowFormula: true,
      valueFormatter: (p: any) => p.value != null ? p.value.toLocaleString() : '',
    },
    {
      field: 'PublishTimeFormatted',
      headerName: 'Publish Time Formatted',
    },
    {
      field: 'Qty',
      headerName: 'Qty',
      type: 'numericColumn',
      cellStyle: { textAlign: 'right' },
      allowFormula: true,
      valueFormatter: (p: any) => p.value != null ? p.value.toLocaleString() : '',
    },
    {
      field: 'Side',
      headerName: 'Side',
    },
    {
      field: 'clmmStrategy',
      headerName: 'Clmm Strategy',
    },
    {
      field: 'TransactionTime',
      headerName: 'Transaction Time',
      type: 'numericColumn',
      cellStyle: { textAlign: 'right' },
      allowFormula: true,
      valueFormatter: (p: any) => p.value != null ? p.value.toLocaleString() : '',
    },
    {
      field: 'UserId',
      headerName: 'User Id',
    },
    {
      field: 'Comment',
      headerName: 'Comment',
    },
    {
      field: 'updatedTime',
      headerName: 'Updated Time',
      type: 'numericColumn',
      cellStyle: { textAlign: 'right' },
      allowFormula: true,
      valueFormatter: (p: any) => p.value != null ? p.value.toLocaleString() : '',
    },
    {
      field: 'CounterParty',
      headerName: 'Counter Party',
    },
    {
      field: 'Venue',
      headerName: 'Venue',
    },
    {
      field: 'TransactTime',
      headerName: 'Transact Time',
      type: 'numericColumn',
      cellStyle: { textAlign: 'right' },
      allowFormula: true,
      valueFormatter: (p: any) => p.value != null ? p.value.toLocaleString() : '',
    },
    {
      field: 'SendingTime',
      headerName: 'Sending Time',
      type: 'numericColumn',
      cellStyle: { textAlign: 'right' },
      allowFormula: true,
      valueFormatter: (p: any) => p.value != null ? p.value.toLocaleString() : '',
    },
    {
      field: 'LineHandlerTimeStamp',
      headerName: 'Line Handler Time Stamp',
      type: 'numericColumn',
      cellStyle: { textAlign: 'right' },
      allowFormula: true,
      valueFormatter: (p: any) => p.value != null ? p.value.toLocaleString() : '',
    }
  ];

  getRowId = (params: any) => params.data?._rowId ?? '';

  gridOptions = {
    pagination: false,
    animateRows: false,
  };

  rowData: DataRow[] = [];

  private subscriptionId: string | null = null;
  private conflation: ConflationSubject<string, DataRow> | null = null;
  private batchBuffer: DataRow[] = [];
  private batchTimer: any = null;

  async ngOnInit(): Promise<void> {
    await this.connectToAmps();
  }

  async connectToAmps(): Promise<void> {
    try {
      this.error.set(null);
      await this.transport.connect({ url: this.ampsUrl });
      this.connected.set(true);
      logger.info('Connected to AMPS', { url: this.ampsUrl });

      // Set up conflation
      this.conflation = new ConflationSubject<string, DataRow>(100);
      this.conflation.subscribeToConflated((item) => {
        this.batchBuffer.push(item.value);
      });

      // Flush batched updates to grid
      this.batchTimer = setInterval(() => {
        if (this.batchBuffer.length > 0) {
          this.grid?.updateRows$.next([...this.batchBuffer]);
          this.batchBuffer = [];
        }
      }, 100);

      // SOW + Subscribe (atomic): initial snapshot then live updates
      // The transport handles group_begin/group_end internally
      const { observable, subscriptionId, sowComplete } = await this.transport.sowAndSubscribe(
        this.topic, undefined,
      );
      this.subscriptionId = subscriptionId;

      const sowRows: DataRow[] = [];
      let sowDone = false;

      observable.subscribe({
        next: (msg: TransportMessage) => {
          try {
            const data = msg.json<any>();
            if (!data) return;
            const row: DataRow = { ...data, _rowId: String(data.ExecutionIdString ?? '') };

            if (!sowDone) {
              sowRows.push(row);
            } else {
              this.conflation?.next({ key: row._rowId, value: row });
              this.messageCount.update(c => c + 1);
            }
          } catch (err) {
            logger.error('Parse error', err);
          }
        },
        error: (err: any) => {
          logger.error('Subscription error', err);
          this.error.set(String(err));
        },
      });

      // Wait for SOW to complete, then load initial data
      await sowComplete;
      sowDone = true;
      this.rowData = sowRows;
      if (this.grid) {
        this.grid.setInitialRowData(sowRows);
      }
      logger.info('SOW complete', { count: sowRows.length });

    } catch (err: any) {
      logger.error('Connection failed', err);
      this.error.set(err.message || String(err));
      this.connected.set(false);
    }
  }

  ngOnDestroy(): void {
    if (this.batchTimer) clearInterval(this.batchTimer);
    this.conflation?.complete();
    if (this.subscriptionId) this.transport.unsubscribe(this.subscriptionId);
    this.transport.disconnect();
  }
}
