import { useEffect, useState } from 'react';
import {
  MODE_LABELS,
  TRANSPORT_LABELS,
  type BlotterConnection,
  type BlotterMode,
  type BlotterSource,
  type ColumnMode,
  type TransportKind,
} from '@macro/prism-core';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useDataSourceStore } from '../data-source-context';

interface FormState {
  name: string;
  category: string;
  transport: TransportKind;
  mode: BlotterMode;
  topic: string;
  filter: string;
  keyField: string;
  conflationMs: string;
  maxRows: string;
  expandArrays: boolean;
  columnMode: ColumnMode;
  url: string;
  logon: string;
  heartbeat: string;
  servers: string;
  clientName: string;
  stream: string;
  hostUrl: string;
  vpnName: string;
  userName: string;
  password: string;
}

const EMPTY: FormState = {
  name: '',
  category: 'Custom',
  transport: 'nats',
  mode: 'streaming',
  topic: '',
  filter: '',
  keyField: '',
  conflationMs: '',
  maxRows: '',
  expandArrays: true,
  columnMode: 'infer',
  url: '',
  logon: '',
  heartbeat: '',
  servers: '',
  clientName: '',
  stream: '',
  hostUrl: '',
  vpnName: '',
  userName: '',
  password: '',
};

function fromSource(s: BlotterSource): FormState {
  const c = s.connection;
  return {
    ...EMPTY,
    name: s.name,
    category: s.category,
    transport: s.transport,
    mode: s.mode,
    topic: s.topic,
    filter: s.filter ?? '',
    keyField: s.keyField ?? '',
    conflationMs: s.conflationMs?.toString() ?? '',
    maxRows: s.maxRows?.toString() ?? '',
    expandArrays: s.expandArrays !== false,
    columnMode: s.columnMode,
    url: c.transport === 'amps' ? c.url : '',
    logon: c.transport === 'amps' ? c.logon ?? '' : '',
    heartbeat: c.transport === 'amps' ? c.heartbeat?.toString() ?? '' : '',
    servers: c.transport === 'nats' || c.transport === 'nats-js' ? c.servers : '',
    clientName: c.transport === 'nats' || c.transport === 'nats-js' ? c.name ?? '' : '',
    stream: c.transport === 'nats-js' ? c.stream ?? '' : '',
    hostUrl: c.transport === 'solace' ? c.hostUrl : '',
    vpnName: c.transport === 'solace' ? c.vpnName : '',
    userName: c.transport === 'solace' ? c.userName : '',
    password: c.transport === 'solace' ? c.password : '',
  };
}

export interface AdHocSourceDialogProps {
  open: boolean;
  source: BlotterSource | null;
  onOpenChange: (open: boolean) => void;
  onSaved: (src: BlotterSource) => void;
}

export function AdHocSourceDialog({ open, source, onOpenChange, onSaved }: AdHocSourceDialogProps) {
  const store = useDataSourceStore();
  const [form, setForm] = useState<FormState>(EMPTY);

  useEffect(() => {
    if (open) setForm(source && source.origin === 'adhoc' ? fromSource(source) : EMPTY);
  }, [open, source]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  const isAppend = form.mode === 'append';
  const num = (s: string): number | undefined => (s.trim() === '' ? undefined : Number(s));

  const canSave = (): boolean => {
    if (!form.name || !form.topic) return false;
    if (form.mode !== 'append' && !form.keyField) return false;
    switch (form.transport) {
      case 'amps':
        return !!form.url;
      case 'nats':
      case 'nats-js':
        return !!form.servers;
      case 'solace':
        return !!(form.hostUrl && form.vpnName && form.userName);
      default:
        return false;
    }
  };

  const buildConnection = (): BlotterConnection => {
    switch (form.transport) {
      case 'amps':
        return {
          transport: 'amps',
          url: form.url,
          ...(form.logon ? { logon: form.logon } : {}),
          ...(num(form.heartbeat) != null ? { heartbeat: num(form.heartbeat) } : {}),
        };
      case 'nats':
        return { transport: 'nats', servers: form.servers, ...(form.clientName ? { name: form.clientName } : {}) };
      case 'nats-js':
        return {
          transport: 'nats-js',
          servers: form.servers,
          ...(form.clientName ? { name: form.clientName } : {}),
          ...(form.stream ? { stream: form.stream } : {}),
        };
      case 'solace':
        return { transport: 'solace', hostUrl: form.hostUrl, vpnName: form.vpnName, userName: form.userName, password: form.password };
    }
  };

  const save = () => {
    if (!canSave()) return;
    const payload: Omit<BlotterSource, 'id' | 'origin'> = {
      name: form.name,
      category: form.category || 'Custom',
      transport: form.transport,
      mode: form.mode,
      connection: buildConnection(),
      topic: form.topic,
      columnMode: form.columnMode,
      ...(form.transport === 'amps' && form.filter ? { filter: form.filter } : {}),
      ...(form.keyField ? { keyField: form.keyField } : {}),
      ...(num(form.conflationMs) != null ? { conflationMs: num(form.conflationMs) } : {}),
      ...(isAppend && num(form.maxRows) != null ? { maxRows: num(form.maxRows) } : {}),
      ...(form.expandArrays === false ? { expandArrays: false } : {}),
    };
    const editing = source && source.origin === 'adhoc' ? source.id : null;
    let result: BlotterSource;
    if (editing) {
      result = { ...payload, id: editing, origin: 'adhoc' };
      store.updateAdhoc(result);
    } else {
      result = store.addAdhoc(payload);
    }
    onSaved(result);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ad-hoc data source</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3 max-h-[60vh] overflow-auto pr-1">
          <Field label="Name">
            <Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. My FX Quotes" />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Transport">
              <Select value={form.transport} onValueChange={(v) => set('transport', v as TransportKind)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(TRANSPORT_LABELS) as TransportKind[]).map((t) => (
                    <SelectItem key={t} value={t}>
                      {TRANSPORT_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Behavior">
              <Select value={form.mode} onValueChange={(v) => set('mode', v as BlotterMode)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(MODE_LABELS) as BlotterMode[]).map((m) => (
                    <SelectItem key={m} value={m}>
                      {MODE_LABELS[m]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Category">
              <Input value={form.category} onChange={(e) => set('category', e.target.value)} placeholder="Custom" />
            </Field>
            <Field label="Columns">
              <Select value={form.columnMode} onValueChange={(v) => set('columnMode', v as ColumnMode)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="infer">Smart inference</SelectItem>
                  <SelectItem value="auto-gen">v36 auto-generate</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>

          {form.transport === 'amps' && (
            <>
              <Field label="AMPS URL">
                <Input value={form.url} onChange={(e) => set('url', e.target.value)} placeholder="ws://host:9008/amps/json" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Logon (optional)">
                  <Input value={form.logon} onChange={(e) => set('logon', e.target.value)} />
                </Field>
                <Field label="Heartbeat (s)">
                  <Input type="number" value={form.heartbeat} onChange={(e) => set('heartbeat', e.target.value)} />
                </Field>
              </div>
            </>
          )}

          {(form.transport === 'nats' || form.transport === 'nats-js') && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Servers">
                <Input value={form.servers} onChange={(e) => set('servers', e.target.value)} placeholder="ws://host:9222" />
              </Field>
              <Field label="Client name (optional)">
                <Input value={form.clientName} onChange={(e) => set('clientName', e.target.value)} />
              </Field>
              {form.transport === 'nats-js' && (
                <Field label="Stream (optional)">
                  <Input value={form.stream} onChange={(e) => set('stream', e.target.value)} placeholder="resolved from subject if blank" />
                </Field>
              )}
            </div>
          )}

          {form.transport === 'solace' && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Host URL">
                <Input value={form.hostUrl} onChange={(e) => set('hostUrl', e.target.value)} placeholder="ws://host:8008" />
              </Field>
              <Field label="VPN">
                <Input value={form.vpnName} onChange={(e) => set('vpnName', e.target.value)} />
              </Field>
              <Field label="User">
                <Input value={form.userName} onChange={(e) => set('userName', e.target.value)} />
              </Field>
              <Field label="Password">
                <Input type="password" value={form.password} onChange={(e) => set('password', e.target.value)} />
              </Field>
            </div>
          )}

          <Field label={form.transport === 'amps' ? 'Topic' : 'Subject / topic'}>
            <Input value={form.topic} onChange={(e) => set('topic', e.target.value)} placeholder="e.g. macro.fx.quotes.>" />
          </Field>

          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="mt-1"
              checked={form.expandArrays}
              onChange={(e) => set('expandArrays', e.target.checked)}
            />
            <span className="flex flex-col gap-0.5">
              <span className="text-sm">Expand array payloads into rows</span>
              <span className="text-xs opacity-60">
                A message whose payload is a JSON array becomes one row per element. Uncheck to treat the
                whole array as a single record.
              </span>
            </span>
          </label>

          <div className="grid grid-cols-2 gap-3">
            {form.transport === 'amps' && (
              <Field label="Filter (optional)">
                <Input value={form.filter} onChange={(e) => set('filter', e.target.value)} placeholder="/status <> 'DONE'" />
              </Field>
            )}
            {!isAppend && (
              <>
                <Field label="Key field">
                  <Input value={form.keyField} onChange={(e) => set('keyField', e.target.value)} placeholder="e.g. symbol" />
                </Field>
                <Field label="Conflation (ms, optional)">
                  <Input type="number" value={form.conflationMs} onChange={(e) => set('conflationMs', e.target.value)} />
                </Field>
              </>
            )}
            {isAppend && (
              <Field label="Max rows (optional)">
                <Input type="number" value={form.maxRows} onChange={(e) => set('maxRows', e.target.value)} />
              </Field>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!canSave()} onClick={save}>
            Open
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-xs opacity-70">{label}</Label>
      {children}
    </div>
  );
}
