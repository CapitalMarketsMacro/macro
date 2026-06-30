import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Logger } from '@macro/logger';
import type { BlotterMode, BlotterSource, TransportKind } from '../models/blotter-source';

/**
 * The data-source repository: a read-only seed catalog (`data-sources.json`, served from the app's
 * public assets) merged with user-defined ad-hoc sources persisted in localStorage. The catalog and
 * ad-hoc lists are signals so the UI reacts to ad-hoc CRUD without manual change detection.
 */
@Injectable({ providedIn: 'root' })
export class DataSourceRepository {
  private readonly http = inject(HttpClient);
  private readonly logger = Logger.getLogger('DataSourceRepository');
  private static readonly LS_KEY = 'prism.adhoc-sources.v1';

  private readonly catalog = signal<BlotterSource[]>([]);
  private readonly adhoc = signal<BlotterSource[]>(this.loadAdhoc());

  /** All sources, catalog first then ad-hoc. */
  readonly all = computed<BlotterSource[]>(() => [...this.catalog(), ...this.adhoc()]);
  readonly adhocSources = computed<BlotterSource[]>(() => this.adhoc());

  /** Load the seed catalog once (called from an APP_INITIALIZER). Failures degrade to an empty catalog. */
  async loadCatalog(): Promise<void> {
    try {
      const seed = await firstValueFrom(this.http.get<BlotterSource[]>('/data-sources.json'));
      this.catalog.set((seed ?? []).map((s) => ({ ...s, origin: 'catalog' as const })));
      this.logger.info('Loaded source catalog', { count: this.catalog().length });
    } catch (err) {
      this.logger.warn('Could not load data-sources.json — starting with an empty catalog', err);
      this.catalog.set([]);
    }
  }

  get(id: string): BlotterSource | undefined {
    return this.all().find((s) => s.id === id);
  }

  byTransport(transport: TransportKind): BlotterSource[] {
    return this.all().filter((s) => s.transport === transport);
  }

  byMode(mode: BlotterMode): BlotterSource[] {
    return this.all().filter((s) => s.mode === mode);
  }

  /** Sources grouped by category, in first-seen order (for the catalog UI). */
  groupedByCategory(): { category: string; sources: BlotterSource[] }[] {
    const groups = new Map<string, BlotterSource[]>();
    for (const s of this.all()) {
      const list = groups.get(s.category) ?? [];
      list.push(s);
      groups.set(s.category, list);
    }
    return [...groups.entries()].map(([category, sources]) => ({ category, sources }));
  }

  // ── Ad-hoc CRUD (catalog is immutable) ──

  addAdhoc(src: Omit<BlotterSource, 'id' | 'origin'>): BlotterSource {
    const created: BlotterSource = { ...src, id: this.newId(src.name), origin: 'adhoc' };
    this.adhoc.update((list) => [...list, created]);
    this.persist();
    return created;
  }

  updateAdhoc(src: BlotterSource): void {
    this.adhoc.update((list) => list.map((s) => (s.id === src.id ? { ...src, origin: 'adhoc' } : s)));
    this.persist();
  }

  removeAdhoc(id: string): void {
    this.adhoc.update((list) => list.filter((s) => s.id !== id));
    this.persist();
  }

  // ── persistence ──

  private newId(name: string): string {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'source';
    const rnd =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID().slice(0, 8)
        : `${this.adhoc().length}`;
    return `adhoc-${slug}-${rnd}`;
  }

  private loadAdhoc(): BlotterSource[] {
    try {
      const raw = localStorage.getItem(DataSourceRepository.LS_KEY);
      const parsed = raw ? (JSON.parse(raw) as BlotterSource[]) : [];
      return parsed.map((s) => ({ ...s, origin: 'adhoc' as const }));
    } catch {
      return [];
    }
  }

  private persist(): void {
    try {
      localStorage.setItem(DataSourceRepository.LS_KEY, JSON.stringify(this.adhoc()));
    } catch (err) {
      this.logger.warn('Could not persist ad-hoc sources', err);
    }
  }
}
