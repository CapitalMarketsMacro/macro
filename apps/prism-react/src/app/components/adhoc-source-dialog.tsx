import { useEffect, useRef, useState } from 'react';
import {
  MODE_LABELS,
  TRANSPORT_LABELS,
  discoverWsTables,
  type BlotterConnection,
  type BlotterMode,
  type BlotterSource,
  type ColumnMode,
  type TransportKind,
  type WsTableInfo,
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
  wsUrl: string;
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
  wsUrl: '',
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
    wsUrl: c.transport === 'websocket' ? c.url : '',
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
  /** Tables announced by a WebSocket table server (null until discovery has run). */
  const [wsTables, setWsTables] = useState<WsTableInfo[] | null>(null);
  const [wsDiscovering, setWsDiscovering] = useState(false);
  const [wsDiscoverError, setWsDiscoverError] = useState<string | null>(null);
  /** Bumped per dialog session / URL change so a stale in-flight discovery can't mutate a newer one. */
  const discoverSeq = useRef(0);

  useEffect(() => {
    if (open) {
      // No source = create blank; an ad-hoc source = edit in place; a catalog source = duplicate
      // (form pre-filled, saved as a NEW ad-hoc copy — the catalog itself is read-only).
      const editing = source && source.origin === 'adhoc';
      discoverSeq.current++; // invalidate any in-flight discovery from a previous dialog session
      setForm(source ? (editing ? fromSource(source) : { ...fromSource(source), name: `${source.name} (copy)` }) : EMPTY);
      setWsDiscovering(false);
      setWsDiscoverError(null);
      // When opening from an existing WebSocket source, seed the table list with its saved table
      // so the quick-picks show it before (or without) re-discovery.
      setWsTables(source?.transport === 'websocket' && source.topic ? [{ name: source.topic }] : null);
    }
  }, [open, source]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  /** Tables discovered for one URL are meaningless for another — drop them when the URL changes. */
  const setWsUrl = (url: string) => {
    discoverSeq.current++;
    set('wsUrl', url);
    setWsTables(null);
    setWsDiscoverError(null);
  };

  /** Adopt the chosen table plus the server's suggested key field / mode. */
  const applyTable = (name: string, tables: WsTableInfo[] | null) => {
    const table = tables?.find((t) => t.name === name);
    setForm((f) => ({
      ...f,
      topic: name,
      ...(table?.keyField ? { keyField: table.keyField } : {}),
      ...(table?.mode && table.mode in MODE_LABELS ? { mode: table.mode as BlotterMode } : {}),
    }));
  };

  /** Connect to the WebSocket URL, read the announced tables, and populate the table quick-picks. */
  const discoverTables = async () => {
    const url = form.wsUrl.trim();
    if (!url || wsDiscovering) return;
    const seq = ++discoverSeq.current;
    setWsDiscovering(true);
    setWsDiscoverError(null);
    try {
      const tables = (await discoverWsTables(url)).filter((t) => typeof t.name === 'string' && t.name.length > 0);
      if (seq !== discoverSeq.current) return; // dialog re-opened / URL changed while in flight
      setWsTables(tables);
      // Auto-pick the first table only when none is set — never clobber a chosen/typed table
      // (functional update: the topic may have been typed while discovery was in flight).
      setForm((f) => {
        if (!tables.length || f.topic) return f;
        const t0 = tables[0];
        return {
          ...f,
          topic: t0.name,
          ...(t0.keyField ? { keyField: t0.keyField } : {}),
          ...(t0.mode && t0.mode in MODE_LABELS ? { mode: t0.mode as BlotterMode } : {}),
        };
      });
    } catch (err) {
      if (seq !== discoverSeq.current) return;
      setWsDiscoverError(err instanceof Error ? err.message : String(err));
    } finally {
      if (seq === discoverSeq.current) setWsDiscovering(false);
    }
  };

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
      case 'websocket':
        return !!form.wsUrl;
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
      case 'websocket':
        return { transport: 'websocket', url: form.wsUrl };
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

          {form.transport === 'websocket' && (
            <Field label="WebSocket URL">
              <div className="flex gap-2">
                <Input
                  className="flex-1"
                  value={form.wsUrl}
                  onChange={(e) => setWsUrl(e.target.value)}
                  placeholder="ws://localhost:3000/prism"
                />
                <Button type="button" variant="secondary" disabled={!form.wsUrl || wsDiscovering} onClick={discoverTables}>
                  {wsDiscovering ? 'Loading…' : 'Load tables'}
                </Button>
              </div>
              {wsDiscoverError ? (
                <span className="text-xs text-destructive">{wsDiscoverError}</span>
              ) : (
                <span className="text-xs opacity-60">
                  The server announces its tables on connect — load them and pick one below.
                </span>
              )}
            </Field>
          )}

          {form.transport === 'websocket' ? (
            <Field label="Table">
              <Input
                value={form.topic}
                onChange={(e) => set('topic', e.target.value)}
                placeholder={wsTables?.length ? 'Pick a table below or type a name' : 'Load tables or type a table name'}
              />
              {wsTables?.length ? (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {wsTables
                    .filter((t) => typeof t.name === 'string' && t.name.length > 0)
                    .map((t) => (
                      <Button
                        key={t.name}
                        type="button"
                        size="sm"
                        variant={form.topic === t.name ? 'default' : 'outline'}
                        title={t.description}
                        onClick={() => applyTable(t.name, wsTables)}
                      >
                        {t.title ? `${t.title} (${t.name})` : t.name}
                      </Button>
                    ))}
                </div>
              ) : null}
            </Field>
          ) : (
            <Field label={form.transport === 'amps' ? 'Topic' : 'Subject / topic'}>
              <Input value={form.topic} onChange={(e) => set('topic', e.target.value)} placeholder="e.g. macro.fx.quotes.>" />
            </Field>
          )}

          {/* WebSocket table sources always expand arrays — there they are protocol framing. */}
          {form.transport !== 'websocket' && (
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
          )}

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
