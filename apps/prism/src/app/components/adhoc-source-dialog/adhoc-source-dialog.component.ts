import { Component, inject, output, signal, ChangeDetectionStrategy } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Dialog } from 'primeng/dialog';
import { Select } from 'primeng/select';
import { InputText } from 'primeng/inputtext';
import { InputNumber } from 'primeng/inputnumber';
import { Checkbox } from 'primeng/checkbox';
import { Button } from 'primeng/button';
import { DataSourceRepository } from '../../services/data-source-repository.service';
import {
  MODE_LABELS,
  TRANSPORT_LABELS,
  discoverRestTables,
  discoverWsTables,
  type BlotterConnection,
  type BlotterMode,
  type BlotterSource,
  type ColumnMode,
  type RollupConfig,
  type TransportKind,
  type WsTableInfo,
} from '@macro/prism-core';

@Component({
  selector: 'app-adhoc-source-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, Dialog, Select, InputText, InputNumber, Checkbox, Button],
  templateUrl: './adhoc-source-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [
    `
      .adhoc-form {
        display: flex;
        flex-direction: column;
        gap: 0.85rem;
      }
      .adhoc-form__grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.85rem;
      }
      .adhoc-form__row {
        display: flex;
        flex-direction: column;
        gap: 0.3rem;
      }
      .adhoc-form__label {
        font-size: 0.8rem;
        opacity: 0.7;
      }
      .adhoc-form__row input,
      .adhoc-form__row :is(p-select, p-inputnumber) {
        width: 100%;
      }
      .adhoc-form__check {
        flex-direction: row;
        align-items: flex-start;
        gap: 0.6rem;
      }
      .adhoc-form__check-label {
        display: flex;
        flex-direction: column;
        gap: 0.15rem;
        font-size: 0.9rem;
        cursor: pointer;
      }
      .adhoc-form__hint {
        font-size: 0.75rem;
        opacity: 0.6;
      }
      .adhoc-form__inline {
        display: flex;
        gap: 0.5rem;
        align-items: center;
      }
      .adhoc-form__inline input {
        flex: 1;
      }
      .adhoc-form__error {
        font-size: 0.75rem;
        color: var(--p-red-400, #f87171);
      }
    `,
  ],
})
export class AdHocSourceDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly repo = inject(DataSourceRepository);

  readonly saved = output<BlotterSource>();
  readonly visible = signal(false);
  private editingId: string | null = null;
  /**
   * Roll-up settings the form doesn't surface (aggregation overrides, expand levels, grand total) —
   * captured from the opened source so an edit/duplicate round-trip doesn't drop them.
   */
  private rollupExtras: Omit<RollupConfig, 'groupBy' | 'enabled'> = {};

  readonly transportOptions = (Object.entries(TRANSPORT_LABELS) as [TransportKind, string][]).map(
    ([value, label]) => ({ value, label }),
  );
  readonly modeOptions = (Object.entries(MODE_LABELS) as [BlotterMode, string][]).map(([value, label]) => ({
    value,
    label,
  }));
  readonly columnModeOptions: { value: ColumnMode; label: string }[] = [
    { value: 'infer', label: 'Smart inference (recommended)' },
    { value: 'auto-gen', label: 'v36 auto-generate' },
  ];

  readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    category: ['Custom', Validators.required],
    transport: ['nats' as TransportKind, Validators.required],
    mode: ['streaming' as BlotterMode, Validators.required],
    topic: ['', Validators.required],
    filter: [''],
    topN: [null as number | null, Validators.min(1)],
    orderBy: [''],
    keyField: [''],
    conflationMs: [null as number | null],
    maxRows: [null as number | null],
    expandArrays: [true],
    columnMode: ['infer' as ColumnMode, Validators.required],
    // Roll-up (optional): comma-separated group-by hierarchy + open-rolled-up flag.
    rollupGroupBy: [''],
    rollupEnabled: [false],
    // AMPS
    url: [''],
    logon: [''],
    heartbeat: [null as number | null],
    // NATS / NATS JetStream
    servers: [''],
    clientName: [''],
    stream: [''],
    // Solace
    hostUrl: [''],
    vpnName: [''],
    userName: [''],
    password: [''],
    // WebSocket
    wsUrl: [''],
    // REST
    restUrl: [''],
  });

  /** Tables announced by a WebSocket/REST table server (null until discovery has run). */
  readonly tables = signal<WsTableInfo[] | null>(null);
  readonly discovering = signal(false);
  readonly discoverError = signal<string | null>(null);
  /** Bumped per dialog session / URL change so a stale in-flight discovery can't mutate a newer one. */
  private discoverEpoch = 0;

  private prevTransport: TransportKind = 'nats';

  constructor() {
    // Tables discovered for one URL are meaningless for another — drop them when the URL changes.
    for (const control of [this.form.controls.wsUrl, this.form.controls.restUrl]) {
      control.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
        this.discoverEpoch++;
        this.tables.set(null);
        this.discoverError.set(null);
      });
    }
  }

  /** 'table' transports pick a table by name; 'subject' transports subscribe to broker subjects. */
  private static family(t: TransportKind): 'table' | 'subject' {
    return t === 'websocket' || t === 'rest' ? 'table' : 'subject';
  }

  /** User switched transport (PrimeNG onChange — programmatic patches don't land here). */
  onTransportChange(next: TransportKind): void {
    const familyChanged =
      AdHocSourceDialogComponent.family(this.prevTransport) !== AdHocSourceDialogComponent.family(next);
    this.prevTransport = next;
    // Discovered tables belong to the previous transport's endpoint.
    this.discoverEpoch++;
    this.tables.set(null);
    this.discoverError.set(null);
    // A broker subject is not a table name (and vice versa) — don't carry it across.
    if (familyChanged) this.form.patchValue({ topic: '' });
    // REST is snapshot-only — pin the behavior so append/streaming can't be picked.
    if (next === 'rest') this.form.patchValue({ mode: 'snapshot-update' });
  }

  get transport(): TransportKind {
    return this.form.controls.transport.value;
  }

  get isAppend(): boolean {
    return this.form.controls.mode.value === 'append';
  }

  /**
   * Open the dialog: no arg = create blank; an ad-hoc source = edit in place; a catalog source =
   * duplicate (form pre-filled, saved as a NEW ad-hoc copy — the catalog itself is read-only).
   */
  show(source?: BlotterSource): void {
    this.editingId = source && source.origin === 'adhoc' ? source.id : null;
    this.discoverEpoch++; // invalidate any in-flight discovery from a previous dialog session
    this.discovering.set(false);
    if (source) {
      this.patchFrom(source);
      if (!this.editingId) {
        this.form.patchValue({ name: `${source.name} (copy)` });
      }
    } else {
      this.rollupExtras = {};
      this.form.reset({ category: 'Custom', transport: 'nats', mode: 'streaming', columnMode: 'infer' });
    }
    // After the form patch (which clears discovery state via the URL subscriptions): when opening
    // from a WebSocket/REST source, seed the table list with the saved table so the select shows
    // it before (or without) re-discovery.
    this.discoverError.set(null);
    this.tables.set(
      (source?.transport === 'websocket' || source?.transport === 'rest') && source.topic
        ? [{ name: source.topic }]
        : null,
    );
    this.prevTransport = this.transport;
    this.visible.set(true);
  }

  /** Discovered table names for the editable select — plain strings so the visible text IS the value. */
  tableNames(): string[] {
    return (this.tables() ?? []).map((t) => t.name).filter((n) => typeof n === 'string' && n.length > 0);
  }

  /** Contact the WebSocket/REST endpoint, read the announced tables, and populate the table select. */
  async discoverTables(): Promise<void> {
    const isRest = this.transport === 'rest';
    const url = (isRest ? this.form.controls.restUrl.value : this.form.controls.wsUrl.value).trim();
    if (!url || this.discovering()) return;
    const epoch = ++this.discoverEpoch;
    this.discovering.set(true);
    this.discoverError.set(null);
    try {
      const tables = await (isRest ? discoverRestTables(url) : discoverWsTables(url));
      if (epoch !== this.discoverEpoch) return; // dialog re-opened / URL changed while in flight
      this.tables.set(tables);
      // Auto-pick the first table only when none is set — never clobber a chosen/typed table.
      if (tables.length && !this.form.controls.topic.value) {
        this.applyTableSuggestions(tables[0].name);
      }
    } catch (err) {
      if (epoch !== this.discoverEpoch) return;
      this.discoverError.set(err instanceof Error ? err.message : String(err));
    } finally {
      if (epoch === this.discoverEpoch) this.discovering.set(false);
    }
  }

  /** onChange of the editable table select: adopt suggestions only for real option picks. */
  onTableChange(event: { originalEvent?: Event; value?: unknown }): void {
    // Typing in the editable input also fires onChange (per keystroke) — the form control already
    // tracks the text, and a half-typed name must not adopt another table's key field / mode.
    if (event.originalEvent?.type === 'input') return;
    if (typeof event.value === 'string' && event.value) this.applyTableSuggestions(event.value);
  }

  /** Adopt the chosen table plus the server's suggested key field / mode (REST stays snapshot-only). */
  private applyTableSuggestions(name: string): void {
    this.form.patchValue({ topic: name });
    const table = this.tables()?.find((t) => t.name === name);
    if (!table) return;
    if (table.keyField) this.form.patchValue({ keyField: table.keyField });
    if (this.transport !== 'rest' && table.mode && table.mode in MODE_LABELS) {
      this.form.patchValue({ mode: table.mode as BlotterMode });
    }
  }

  canSave(): boolean {
    const v = this.form.getRawValue();
    if (!v.name) return false;
    // REST may leave the table blank — the URL itself can be the rows endpoint.
    if (!v.topic && v.transport !== 'rest') return false;
    if (v.mode !== 'append' && !v.keyField) return false;
    if (v.transport === 'amps' && v.topN != null && (!Number.isInteger(v.topN) || v.topN < 1)) return false;
    switch (v.transport) {
      case 'amps':
        return !!v.url;
      case 'nats':
      case 'nats-js':
        return !!v.servers;
      case 'solace':
        return !!(v.hostUrl && v.vpnName && v.userName);
      case 'websocket':
        return !!v.wsUrl;
      case 'rest':
        return !!v.restUrl;
      default:
        return false;
    }
  }

  save(): void {
    if (!this.canSave()) return;
    const v = this.form.getRawValue();
    const payload: Omit<BlotterSource, 'id' | 'origin'> = {
      name: v.name,
      category: v.category || 'Custom',
      transport: v.transport,
      mode: v.mode,
      connection: this.buildConnection(),
      topic: v.topic,
      columnMode: v.columnMode,
      ...(v.transport === 'amps' && v.filter ? { filter: v.filter } : {}),
      ...(v.transport === 'amps' && v.topN != null ? { topN: v.topN } : {}),
      ...(v.transport === 'amps' && v.orderBy.trim() ? { orderBy: v.orderBy.trim() } : {}),
      ...(v.keyField ? { keyField: v.keyField } : {}),
      // Snapshot-only REST has no stream to conflate — drop a value left over from another transport.
      ...(v.conflationMs != null && v.transport !== 'rest' ? { conflationMs: v.conflationMs } : {}),
      ...(v.mode === 'append' && v.maxRows != null ? { maxRows: v.maxRows } : {}),
      ...(v.expandArrays === false ? { expandArrays: false } : {}),
      ...(this.buildRollup(v.rollupGroupBy, v.rollupEnabled) ?? {}),
    };
    const result = this.editingId
      ? this.updateExisting(this.editingId, payload)
      : this.repo.addAdhoc(payload);
    this.visible.set(false);
    this.saved.emit(result);
  }

  cancel(): void {
    this.visible.set(false);
  }

  /**
   * `"desk, book"` + flag → `{ rollup }` fragment (with preserved extras). A blank hierarchy with
   * "open rolled up" checked still persists — the blotter opens on the suggested hierarchy.
   */
  private buildRollup(groupByText: string, enabled: boolean): { rollup: RollupConfig } | null {
    const groupBy = groupByText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (!groupBy.length && !enabled) return null;
    return { rollup: { ...this.rollupExtras, groupBy, ...(enabled ? { enabled: true } : {}) } };
  }

  private updateExisting(id: string, payload: Omit<BlotterSource, 'id' | 'origin'>): BlotterSource {
    const updated: BlotterSource = { ...payload, id, origin: 'adhoc' };
    this.repo.updateAdhoc(updated);
    return updated;
  }

  private buildConnection(): BlotterConnection {
    const v = this.form.getRawValue();
    switch (v.transport) {
      case 'amps':
        return {
          transport: 'amps',
          url: v.url,
          ...(v.logon ? { logon: v.logon } : {}),
          ...(v.heartbeat != null ? { heartbeat: v.heartbeat } : {}),
        };
      case 'nats':
        return { transport: 'nats', servers: v.servers, ...(v.clientName ? { name: v.clientName } : {}) };
      case 'nats-js':
        return {
          transport: 'nats-js',
          servers: v.servers,
          ...(v.clientName ? { name: v.clientName } : {}),
          ...(v.stream ? { stream: v.stream } : {}),
        };
      case 'solace':
        return {
          transport: 'solace',
          hostUrl: v.hostUrl,
          vpnName: v.vpnName,
          userName: v.userName,
          password: v.password ?? '',
        };
      case 'websocket':
        return { transport: 'websocket', url: v.wsUrl };
      case 'rest':
        return { transport: 'rest', url: v.restUrl };
    }
  }

  private patchFrom(source: BlotterSource): void {
    const c = source.connection;
    const { groupBy: _groupBy, enabled: _enabled, ...rollupExtras } = source.rollup ?? { groupBy: [] };
    this.rollupExtras = rollupExtras;
    this.form.reset({
      name: source.name,
      category: source.category,
      transport: source.transport,
      mode: source.mode,
      topic: source.topic,
      filter: source.filter ?? '',
      topN: source.topN ?? null,
      orderBy: source.orderBy ?? '',
      keyField: source.keyField ?? '',
      conflationMs: source.conflationMs ?? null,
      maxRows: source.maxRows ?? null,
      expandArrays: source.expandArrays !== false,
      columnMode: source.columnMode,
      rollupGroupBy: source.rollup?.groupBy.join(', ') ?? '',
      rollupEnabled: !!source.rollup?.enabled,
      url: c.transport === 'amps' ? c.url : '',
      logon: c.transport === 'amps' ? c.logon ?? '' : '',
      heartbeat: c.transport === 'amps' ? c.heartbeat ?? null : null,
      servers: c.transport === 'nats' || c.transport === 'nats-js' ? c.servers : '',
      clientName: c.transport === 'nats' || c.transport === 'nats-js' ? c.name ?? '' : '',
      stream: c.transport === 'nats-js' ? c.stream ?? '' : '',
      hostUrl: c.transport === 'solace' ? c.hostUrl : '',
      vpnName: c.transport === 'solace' ? c.vpnName : '',
      userName: c.transport === 'solace' ? c.userName : '',
      password: c.transport === 'solace' ? c.password : '',
      wsUrl: c.transport === 'websocket' ? c.url : '',
      restUrl: c.transport === 'rest' ? c.url : '',
    });
  }
}
