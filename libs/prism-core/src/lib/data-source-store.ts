import { Logger } from '@macro/logger';
import type { BlotterMode, BlotterSource, TransportKind } from './blotter-source';

const LS_KEY = 'prism.adhoc-sources.v1';

/**
 * Framework-free data-source repository: a read-only seed catalog merged with user-defined ad-hoc
 * sources persisted in localStorage. `subscribe`/`getAll` are useSyncExternalStore-shaped; the
 * Angular app wraps this with signals, the React app with `useSyncExternalStore`. The catalog fetch
 * is injected (`loadCatalog(fetchJson)`) so the lib has no HttpClient/fetch dependency.
 */
export class DataSourceStore {
  private readonly logger = Logger.getLogger('DataSourceStore');
  private catalog: BlotterSource[] = [];
  private adhoc: BlotterSource[] = this.loadAdhoc();
  /** Memoized `[...catalog, ...adhoc]` snapshot — stable reference between changes (React identity). */
  private allCache: BlotterSource[] = [...this.adhoc];
  private readonly listeners = new Set<() => void>();

  readonly subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };

  readonly getAll = (): BlotterSource[] => this.allCache;
  readonly getAdhoc = (): BlotterSource[] => this.adhoc;

  private emit(): void {
    this.allCache = [...this.catalog, ...this.adhoc];
    for (const l of this.listeners) l();
  }

  /** Load the seed catalog via an injected fetcher. Failures degrade to an empty catalog. */
  async loadCatalog(
    fetchJson: (url: string) => Promise<BlotterSource[]>,
    url = '/data-sources.json',
  ): Promise<void> {
    try {
      const seed = await fetchJson(url);
      this.catalog = (seed ?? []).map((s) => ({ ...s, origin: 'catalog' as const }));
      this.logger.info('Loaded source catalog', { count: this.catalog.length });
    } catch (err) {
      this.logger.warn('Could not load data-sources.json — starting with an empty catalog', err);
      this.catalog = [];
    }
    this.emit();
  }

  get(id: string): BlotterSource | undefined {
    return this.allCache.find((s) => s.id === id);
  }

  byTransport(transport: TransportKind): BlotterSource[] {
    return this.allCache.filter((s) => s.transport === transport);
  }

  byMode(mode: BlotterMode): BlotterSource[] {
    return this.allCache.filter((s) => s.mode === mode);
  }

  /** Sources grouped by category, in first-seen order (for the catalog UI). */
  groupedByCategory(): { category: string; sources: BlotterSource[] }[] {
    const groups = new Map<string, BlotterSource[]>();
    for (const s of this.allCache) {
      const list = groups.get(s.category) ?? [];
      list.push(s);
      groups.set(s.category, list);
    }
    return [...groups.entries()].map(([category, sources]) => ({ category, sources }));
  }

  // ── Ad-hoc CRUD (catalog is immutable) ──

  addAdhoc(src: Omit<BlotterSource, 'id' | 'origin'>): BlotterSource {
    const created: BlotterSource = { ...src, id: this.newId(src.name), origin: 'adhoc' };
    this.adhoc = [...this.adhoc, created];
    this.persist();
    this.emit();
    return created;
  }

  updateAdhoc(src: BlotterSource): void {
    this.adhoc = this.adhoc.map((s) => (s.id === src.id ? { ...src, origin: 'adhoc' } : s));
    this.persist();
    this.emit();
  }

  removeAdhoc(id: string): void {
    this.adhoc = this.adhoc.filter((s) => s.id !== id);
    this.persist();
    this.emit();
  }

  // ── persistence ──

  private newId(name: string): string {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'source';
    const rnd =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID().slice(0, 8)
        : `${this.adhoc.length}`;
    return `adhoc-${slug}-${rnd}`;
  }

  private loadAdhoc(): BlotterSource[] {
    try {
      const raw = localStorage.getItem(LS_KEY);
      const parsed = raw ? (JSON.parse(raw) as BlotterSource[]) : [];
      return parsed.map((s) => ({ ...s, origin: 'adhoc' as const }));
    } catch {
      return [];
    }
  }

  private persist(): void {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(this.adhoc));
    } catch (err) {
      this.logger.warn('Could not persist ad-hoc sources', err);
    }
  }
}
