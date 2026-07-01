import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { MODE_LABELS, TRANSPORT_LABELS, type BlotterMode, type BlotterSource } from '@macro/prism-core';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAllSources, useDataSourceStore } from '../data-source-context';

export interface SourcePickerProps {
  /** The element that opens the picker (rendered via Radix `asChild`). */
  trigger: ReactNode;
  activeId?: string | null;
  /** Switch the blotter to this source. */
  onSelect: (src: BlotterSource) => void;
  /** Open the ad-hoc dialog for a brand-new source. */
  onNew: () => void;
  /** Open the ad-hoc dialog to edit an existing ad-hoc source. */
  onEdit: (src: BlotterSource) => void;
}

const modeVariant = (m: BlotterMode): 'success' | 'warning' | 'destructive' =>
  m === 'streaming' ? 'destructive' : m === 'append' ? 'warning' : 'success';

/** Subtle, in-place source switcher: search + grouped list + ad-hoc edit/delete + "New". */
export function SourcePicker({ trigger, activeId, onSelect, onNew, onEdit }: SourcePickerProps) {
  const store = useDataSourceStore();
  const all = useAllSources();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');

  const groups = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const matched = q
      ? all.filter(
          (s) =>
            s.name.toLowerCase().includes(q) ||
            s.category.toLowerCase().includes(q) ||
            s.topic.toLowerCase().includes(q) ||
            TRANSPORT_LABELS[s.transport].toLowerCase().includes(q),
        )
      : all;
    const map = new Map<string, BlotterSource[]>();
    for (const s of matched) {
      const list = map.get(s.category) ?? [];
      list.push(s);
      map.set(s.category, list);
    }
    return [...map.entries()].map(([category, sources]) => ({ category, sources }));
  }, [all, filter]);

  const choose = (src: BlotterSource) => {
    setOpen(false);
    onSelect(src);
  };
  const handleNew = () => {
    setOpen(false);
    onNew();
  };
  const handleEdit = (src: BlotterSource, e: React.MouseEvent) => {
    e.stopPropagation();
    setOpen(false);
    onEdit(src);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-[min(24rem,90vw)] p-2" align="start">
        <Input
          autoFocus
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search data sources…"
          className="mb-2"
        />
        <div className="max-h-80 overflow-y-auto flex flex-col gap-0.5">
          {groups.map((group) => (
            <div key={group.category}>
              <div className="text-[0.7rem] uppercase tracking-wide opacity-55 px-1 pt-2 pb-1">{group.category}</div>
              {group.sources.map((src) => (
                <div
                  key={src.id}
                  className={`group flex w-full items-center justify-between gap-1 rounded-md ${
                    src.id === activeId ? 'border border-primary' : 'border border-transparent'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => choose(src)}
                    className="flex flex-1 min-w-0 flex-col gap-1 rounded-md px-2 py-1.5 text-left hover:bg-accent"
                  >
                    <span className="font-medium truncate">{src.name}</span>
                    <span className="flex gap-1 flex-wrap">
                      <Badge variant="secondary">{TRANSPORT_LABELS[src.transport]}</Badge>
                      <Badge variant={modeVariant(src.mode)}>{MODE_LABELS[src.mode]}</Badge>
                      {src.origin === 'adhoc' && <Badge variant="outline">ad-hoc</Badge>}
                    </span>
                  </button>
                  {src.origin === 'adhoc' && (
                    <span className="flex gap-1 pr-1 opacity-70 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                      <button
                        type="button"
                        aria-label="Edit source"
                        title="Edit"
                        className="p-1 rounded hover:bg-background"
                        onClick={(e) => handleEdit(src, e)}
                      >
                        <Pencil className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label="Delete source"
                        title="Delete"
                        className="p-1 rounded text-destructive hover:bg-destructive/10"
                        onClick={(e) => {
                          e.stopPropagation();
                          store.removeAdhoc(src.id);
                        }}
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </span>
                  )}
                </div>
              ))}
            </div>
          ))}
          {groups.length === 0 && (
            <p className="opacity-60 text-sm px-1 py-3">No sources match “{filter}”.</p>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 border-t mt-2 pt-2">
          <Button size="sm" onClick={handleNew}>
            <Plus className="size-4" /> New data source
          </Button>
          <Link
            to="/sources"
            onClick={() => setOpen(false)}
            className="text-sm text-primary no-underline hover:underline"
          >
            Browse all
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
