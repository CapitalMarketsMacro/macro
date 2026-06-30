import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Pencil, Plus, Trash2 } from 'lucide-react';
import { MODE_LABELS, TRANSPORT_LABELS, type BlotterMode, type BlotterSource } from '@macro/prism-core';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAllSources, useDataSourceStore } from '../data-source-context';
import { AdHocSourceDialog } from './adhoc-source-dialog';

type GroupBy = 'category' | 'transport' | 'mode';

export function SourceCatalog() {
  const store = useDataSourceStore();
  const all = useAllSources();
  const navigate = useNavigate();
  const [groupBy, setGroupBy] = useState<GroupBy>('category');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editSource, setEditSource] = useState<BlotterSource | null>(null);

  const groups = useMemo(() => buildGroups(groupBy, all), [groupBy, all]);

  const open = (src: BlotterSource) => navigate(`/blotter?source=${encodeURIComponent(src.id)}`);
  const addAdhoc = () => {
    setEditSource(null);
    setDialogOpen(true);
  };
  const edit = (src: BlotterSource) => {
    setEditSource(src);
    setDialogOpen(true);
  };

  const modeVariant = (m: BlotterMode): 'success' | 'warning' | 'destructive' =>
    m === 'streaming' ? 'destructive' : m === 'append' ? 'warning' : 'success';

  return (
    <div>
      <header className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <h2 className="text-xl font-bold m-0">Data Sources</h2>
          <p className="opacity-70 mt-1">
            Pick a source to open a snapshot + real-time blotter, or define your own ad-hoc source.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="inline-flex rounded-md border overflow-hidden">
            {(['category', 'transport', 'mode'] as GroupBy[]).map((g) => (
              <button
                key={g}
                onClick={() => setGroupBy(g)}
                className={`text-sm px-3 py-1.5 ${groupBy === g ? 'bg-primary text-primary-foreground' : 'bg-background'}`}
              >
                {g === 'category' ? 'Category' : g === 'transport' ? 'Type' : 'Behavior'}
              </button>
            ))}
          </div>
          <Button onClick={addAdhoc}>
            <Plus className="size-4" /> Add ad-hoc source
          </Button>
        </div>
      </header>

      {groups.map((group) => (
        <section key={group.title} className="mb-7">
          <h3 className="text-sm uppercase tracking-wide opacity-60 mb-3">{group.title}</h3>
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(20rem, 1fr))' }}>
            {group.sources.map((src) => (
              <Card key={src.id}>
                <CardContent className="pt-4">
                  <div className="flex gap-1.5 flex-wrap mb-2">
                    <Badge variant="secondary">{TRANSPORT_LABELS[src.transport]}</Badge>
                    <Badge variant={modeVariant(src.mode)}>{MODE_LABELS[src.mode]}</Badge>
                    {src.origin === 'adhoc' && <Badge variant="outline">ad-hoc</Badge>}
                  </div>
                  <h4 className="text-base font-semibold mb-1">{src.name}</h4>
                  <p className="text-sm opacity-70 min-h-10">{src.description}</p>
                  <div className="flex flex-col gap-1 text-xs opacity-70 mt-2">
                    <span>Category: {src.category}</span>
                    <span className="truncate">Topic: {src.topic}</span>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button size="sm" onClick={() => open(src)}>
                    Open <ArrowRight className="size-4" />
                  </Button>
                  {src.origin === 'adhoc' && (
                    <>
                      <Button size="icon" variant="ghost" aria-label="Edit" onClick={() => edit(src)}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button size="icon" variant="ghost" aria-label="Delete" onClick={() => store.removeAdhoc(src.id)}>
                        <Trash2 className="size-4" />
                      </Button>
                    </>
                  )}
                </CardFooter>
              </Card>
            ))}
          </div>
        </section>
      ))}

      {groups.length === 0 && <p className="opacity-70">No data sources yet — add an ad-hoc source to get started.</p>}

      <AdHocSourceDialog
        open={dialogOpen}
        source={editSource}
        onOpenChange={setDialogOpen}
        onSaved={(src) => {
          setDialogOpen(false);
          open(src);
        }}
      />
    </div>
  );
}

function buildGroups(by: GroupBy, sources: BlotterSource[]): { title: string; sources: BlotterSource[] }[] {
  const labels: Record<string, string> = by === 'transport' ? TRANSPORT_LABELS : by === 'mode' ? MODE_LABELS : {};
  const map = new Map<string, BlotterSource[]>();
  for (const s of sources) {
    const key = by === 'transport' ? s.transport : by === 'mode' ? s.mode : s.category;
    const list = map.get(key) ?? [];
    list.push(s);
    map.set(key, list);
  }
  return [...map.entries()].map(([key, list]) => ({ title: labels[key] ?? key, sources: list }));
}
