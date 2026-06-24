import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CustomToolPanelProps } from 'ag-grid-react';
import {
  FORMAT_REGISTRY,
  formatValue,
  kindsByGroup,
  presetsByGroup,
  previewStyle,
  setSpecField,
  type ColumnFormatSpec,
  type FormatFieldDef,
  type FormatPreset,
  type FormattableColumn,
} from '../../index';
import type { ColumnFormatStore } from '../column-format-store';

/** Props AG Grid passes — our `store` is merged in via `toolPanelParams`. */
export type MacroFormatToolPanelProps = CustomToolPanelProps & { store: ColumnFormatStore };

const SAMPLE_ROW = { symbol: 'EURUSD' };
const PRESET_GROUPS = presetsByGroup();
const KIND_GROUPS = kindsByGroup();

const v = (name: string, fallback: string) => `var(${name}, ${fallback})`;
const border = v('--ag-border-color', '#dde2eb');
const fg = v('--ag-foreground-color', '#181d1f');
const sub = v('--ag-secondary-foreground-color', '#5f6b7a');
const bg = v('--ag-background-color', '#fff');
const accent = v('--ag-range-selection-border-color', '#3b82f6');
const hover = v('--ag-row-hover-color', 'rgba(59,130,246,0.06)');

const css = {
  panel: { display: 'flex', flexDirection: 'column' as const, gap: 14, padding: '10px 12px',
    font: 'inherit', fontSize: 12, color: fg, boxSizing: 'border-box' as const, overflowY: 'auto' as const },
  section: { display: 'flex', flexDirection: 'column' as const, gap: 6 },
  head: { display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    fontWeight: 600, textTransform: 'uppercase' as const, fontSize: 10, letterSpacing: '0.04em', color: sub },
  link: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, padding: 0, color: accent },
  input: { width: '100%', boxSizing: 'border-box' as const, padding: '4px 6px', fontSize: 12,
    fontFamily: 'inherit', borderRadius: 4, border: `1px solid ${border}`, background: bg, color: fg },
  collist: { display: 'flex', flexDirection: 'column' as const, gap: 2, maxHeight: 160, overflowY: 'auto' as const,
    border: `1px solid ${border}`, borderRadius: 4, padding: 4 },
  col: { display: 'flex', alignItems: 'center', gap: 6, padding: '2px 4px', borderRadius: 3, cursor: 'pointer' },
  colName: { flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const },
  dot: { color: accent, fontSize: 9 },
  groupLabel: { fontSize: 10, fontWeight: 600, color: sub, marginTop: 2 },
  row: { display: 'flex', flexWrap: 'wrap' as const, gap: 4 },
  chip: (active: boolean): React.CSSProperties => ({ padding: '3px 8px', fontSize: 11, fontFamily: 'inherit',
    borderRadius: 10, cursor: 'pointer', border: `1px solid ${active ? accent : border}`,
    background: active ? accent : bg, color: active ? '#fff' : sub }),
  fields: { display: 'flex', flexDirection: 'column' as const, gap: 6 },
  field: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  fieldLabel: { fontSize: 11, color: sub, whiteSpace: 'nowrap' as const },
  control: { minWidth: 92, padding: '4px 6px', fontSize: 12, fontFamily: 'inherit', borderRadius: 4,
    border: `1px solid ${border}`, background: bg, color: fg },
  stepper: { display: 'flex', alignItems: 'center', border: `1px solid ${border}`, borderRadius: 5, overflow: 'hidden' },
  stepBtn: { width: 26, height: 24, border: 'none', cursor: 'pointer', fontSize: 14, background: bg, color: fg },
  stepVal: { minWidth: 28, textAlign: 'center' as const, lineHeight: '24px',
    borderLeft: `1px solid ${border}`, borderRight: `1px solid ${border}` },
  toggle: (on: boolean): React.CSSProperties => ({ minWidth: 56, padding: '4px 8px', borderRadius: 5, cursor: 'pointer',
    border: `1px solid ${on ? accent : border}`, background: on ? accent : bg, color: on ? '#fff' : sub, fontFamily: 'inherit' }),
  preview: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
    padding: '6px 8px', borderRadius: 5, background: hover },
  previewCode: { fontWeight: 600, fontSize: 13 },
  actions: { display: 'flex', gap: 6 },
  apply: (disabled: boolean): React.CSSProperties => ({ flex: 1, padding: 6, fontSize: 12, fontWeight: 500,
    borderRadius: 5, cursor: disabled ? 'default' : 'pointer', fontFamily: 'inherit',
    border: `1px solid ${accent}`, background: accent, color: '#fff', opacity: disabled ? 0.5 : 1 }),
  reset: (disabled: boolean): React.CSSProperties => ({ flex: 1, padding: 6, fontSize: 12, fontWeight: 500,
    borderRadius: 5, cursor: disabled ? 'default' : 'pointer', fontFamily: 'inherit',
    border: `1px solid ${border}`, background: bg, color: sub, opacity: disabled ? 0.5 : 1 }),
  activeRow: { display: 'flex', alignItems: 'center', gap: 6, padding: '3px 6px', borderRadius: 4, background: hover },
  activeName: { flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const },
  activeKind: { fontSize: 10, color: sub },
  x: { border: 'none', background: 'none', cursor: 'pointer', fontSize: 15, lineHeight: 1, color: sub },
};

export function MacroFormatToolPanel({ store, api }: MacroFormatToolPanelProps) {
  const [columns, setColumns] = useState<FormattableColumn[]>([]);
  const [active, setActive] = useState<[string, ColumnFormatSpec][]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [draft, setDraft] = useState<ColumnFormatSpec>({ kind: 'number', decimals: 2 });

  const refresh = useCallback(() => {
    setColumns(store.listFormattableColumns());
    setActive(store.entries());
  }, [store]);

  useEffect(() => {
    refresh();
    const off = store.onChange(refresh);
    const onCols = () => setColumns(store.listFormattableColumns());
    api.addEventListener('displayedColumnsChanged', onCols);
    return () => {
      off();
      api.removeEventListener('displayedColumnsChanged', onCols);
    };
  }, [store, api, refresh]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return columns;
    return columns.filter((c) => c.headerName.toLowerCase().includes(q) || c.colId.toLowerCase().includes(q));
  }, [columns, search]);

  const kindDef = FORMAT_REGISTRY[draft.kind];
  const preview = formatValue(kindDef.example, draft, SAMPLE_ROW);
  const previewCss = previewStyle(draft, kindDef.example) as React.CSSProperties;
  const specVal = (key: string): unknown => (draft as Record<string, unknown>)[key];
  const strVal = (key: string): string => (specVal(key) == null ? '' : String(specVal(key)));

  const toggleColumn = (colId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(colId)) next.delete(colId);
      else next.add(colId);
      return next;
    });
  };
  const onField = (key: string, raw: unknown) => setDraft((d) => setSpecField(d, key, raw));
  const onStep = (f: FormatFieldDef, delta: number) => {
    const current = Number(specVal(f.key) ?? 0);
    onField(f.key, Math.max(f.min ?? 0, Math.min(f.max ?? 10, current + delta)));
  };
  const apply = () => selected.forEach((colId) => store.apply(colId, draft));
  const resetSelected = () => selected.forEach((colId) => store.clear(colId));
  const headerFor = (colId: string) => columns.find((c) => c.colId === colId)?.headerName ?? colId;
  const canApply = selected.size > 0;

  return (
    <div style={css.panel}>
      {/* Columns */}
      <section style={css.section}>
        <header style={css.head}>
          <span>Columns</span>
          {selected.size > 0 && (
            <button type="button" style={css.link} onClick={() => setSelected(new Set())}>
              Clear ({selected.size})
            </button>
          )}
        </header>
        <input
          style={css.input}
          type="search"
          placeholder="Filter columns…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div style={css.collist}>
          {filtered.length === 0 && <p style={{ margin: 4, color: sub }}>No columns match.</p>}
          {filtered.map((col) => (
            <label key={col.colId} style={css.col}>
              <input type="checkbox" checked={selected.has(col.colId)} onChange={() => toggleColumn(col.colId)} />
              <span style={css.colName}>{col.headerName}</span>
              {col.active && <span style={css.dot} title="Formatted">●</span>}
            </label>
          ))}
        </div>
      </section>

      {/* Presets */}
      <section style={css.section}>
        <header style={css.head}><span>Presets</span></header>
        {PRESET_GROUPS.map((grp) => (
          <div key={grp.group}>
            <div style={css.groupLabel}>{grp.group}</div>
            <div style={css.row}>
              {grp.presets.map((preset: FormatPreset) => (
                <button key={preset.id} type="button" style={css.chip(false)} title={preset.hint ?? ''}
                  onClick={() => setDraft({ ...preset.spec })}>
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* Editor */}
      <section style={css.section}>
        <header style={css.head}><span>Format</span></header>
        <div style={css.row}>
          {KIND_GROUPS.flatMap((g) => g.kinds).map((kind) => (
            <button key={kind.kind} type="button" style={css.chip(draft.kind === kind.kind)}
              onClick={() => setDraft({ ...kind.defaults })}>
              {kind.label}
            </button>
          ))}
        </div>

        <div style={css.fields}>
          {kindDef.fields.map((field) => (
            <div key={field.key} style={css.field}>
              <span style={css.fieldLabel}>{field.label}</span>
              {field.control === 'stepper' && (
                <div style={css.stepper}>
                  <button type="button" style={css.stepBtn} onClick={() => onStep(field, -1)}>−</button>
                  <span style={css.stepVal}>{strVal(field.key) || '0'}</span>
                  <button type="button" style={css.stepBtn} onClick={() => onStep(field, 1)}>+</button>
                </div>
              )}
              {field.control === 'toggle' && (
                <button type="button" style={css.toggle(Boolean(specVal(field.key)))}
                  onClick={() => onField(field.key, !specVal(field.key))}>
                  {specVal(field.key) ? 'On' : 'Off'}
                </button>
              )}
              {field.control === 'select' && (
                <select style={css.control} value={strVal(field.key) || field.options?.[0]?.value}
                  onChange={(e) => onField(field.key, e.target.value)}>
                  {field.options?.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              )}
              {field.control === 'text' && (
                <input style={css.control} type="text" placeholder={field.placeholder ?? ''}
                  value={strVal(field.key)} onChange={(e) => onField(field.key, e.target.value)} />
              )}
            </div>
          ))}
        </div>

        <div style={css.preview}>
          <span style={css.fieldLabel}>Preview</span>
          <code style={{ ...css.previewCode, ...previewCss }}>{preview}</code>
        </div>

        <div style={css.actions}>
          <button type="button" style={css.apply(!canApply)} disabled={!canApply} onClick={apply}>
            Apply{selected.size > 0 ? ` (${selected.size})` : ''}
          </button>
          <button type="button" style={css.reset(!canApply)} disabled={!canApply} onClick={resetSelected}>
            Reset
          </button>
        </div>
      </section>

      {/* Active */}
      {active.length > 0 && (
        <section style={css.section}>
          <header style={css.head}>
            <span>Applied ({active.length})</span>
            <button type="button" style={css.link} onClick={() => store.clearAll()}>Reset all</button>
          </header>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {active.map(([colId, spec]) => (
              <div key={colId} style={css.activeRow}>
                <span style={css.activeName}>{headerFor(colId)}</span>
                <span style={css.activeKind}>{spec.kind}</span>
                <button type="button" style={css.x} title="Remove" onClick={() => store.clear(colId)}>×</button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export default MacroFormatToolPanel;
