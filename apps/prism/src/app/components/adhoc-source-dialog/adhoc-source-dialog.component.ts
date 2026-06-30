import { Component, inject, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Dialog } from 'primeng/dialog';
import { Select } from 'primeng/select';
import { InputText } from 'primeng/inputtext';
import { InputNumber } from 'primeng/inputnumber';
import { Button } from 'primeng/button';
import { DataSourceRepository } from '../../services/data-source-repository.service';
import {
  MODE_LABELS,
  TRANSPORT_LABELS,
  type BlotterConnection,
  type BlotterMode,
  type BlotterSource,
  type ColumnMode,
  type TransportKind,
} from '../../models/blotter-source';

@Component({
  selector: 'app-adhoc-source-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, Dialog, Select, InputText, InputNumber, Button],
  templateUrl: './adhoc-source-dialog.component.html',
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
    `,
  ],
})
export class AdHocSourceDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly repo = inject(DataSourceRepository);

  readonly saved = output<BlotterSource>();
  readonly visible = signal(false);
  private editingId: string | null = null;

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
    keyField: [''],
    conflationMs: [null as number | null],
    maxRows: [null as number | null],
    columnMode: ['infer' as ColumnMode, Validators.required],
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
  });

  get transport(): TransportKind {
    return this.form.controls.transport.value;
  }

  get isAppend(): boolean {
    return this.form.controls.mode.value === 'append';
  }

  show(source?: BlotterSource): void {
    this.editingId = source && source.origin === 'adhoc' ? source.id : null;
    if (source) {
      this.patchFrom(source);
    } else {
      this.form.reset({ category: 'Custom', transport: 'nats', mode: 'streaming', columnMode: 'infer' });
    }
    this.visible.set(true);
  }

  canSave(): boolean {
    const v = this.form.getRawValue();
    if (!v.name || !v.topic) return false;
    if (v.mode !== 'append' && !v.keyField) return false;
    switch (v.transport) {
      case 'amps':
        return !!v.url;
      case 'nats':
      case 'nats-js':
        return !!v.servers;
      case 'solace':
        return !!(v.hostUrl && v.vpnName && v.userName);
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
      ...(v.keyField ? { keyField: v.keyField } : {}),
      ...(v.conflationMs != null ? { conflationMs: v.conflationMs } : {}),
      ...(v.mode === 'append' && v.maxRows != null ? { maxRows: v.maxRows } : {}),
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
    }
  }

  private patchFrom(source: BlotterSource): void {
    const c = source.connection;
    this.form.reset({
      name: source.name,
      category: source.category,
      transport: source.transport,
      mode: source.mode,
      topic: source.topic,
      filter: source.filter ?? '',
      keyField: source.keyField ?? '',
      conflationMs: source.conflationMs ?? null,
      maxRows: source.maxRows ?? null,
      columnMode: source.columnMode,
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
    });
  }
}
