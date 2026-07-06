import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { DataSourceStore, type BlotterMode, type BlotterSource, type TransportKind } from '@macro/prism-core';

/**
 * Angular adapter over the framework-free {@link DataSourceStore}. Bridges the store's
 * subscribe/getAll surface to signals (so the catalog UI reacts to ad-hoc CRUD) and injects the
 * Angular `HttpClient` as the catalog fetcher. Public API is unchanged from the original service,
 * so consumers and `app.config.ts` are untouched.
 */
@Injectable({ providedIn: 'root' })
export class DataSourceRepository {
  private readonly http = inject(HttpClient);
  private readonly store = new DataSourceStore();
  /** Bumped on every store change to invalidate the computed signals below. */
  private readonly version = signal(0);

  constructor() {
    this.store.subscribe(() => this.version.update((v) => v + 1));
  }

  readonly all = computed<BlotterSource[]>(() => {
    this.version();
    return this.store.getAll();
  });
  readonly adhocSources = computed<BlotterSource[]>(() => {
    this.version();
    return this.store.getAdhoc();
  });

  loadCatalog(): Promise<void> {
    return this.store.loadCatalog((url) => firstValueFrom(this.http.get<BlotterSource[]>(url)));
  }

  get(id: string): BlotterSource | undefined {
    return this.store.get(id);
  }

  byTransport(transport: TransportKind): BlotterSource[] {
    return this.store.byTransport(transport);
  }

  byMode(mode: BlotterMode): BlotterSource[] {
    return this.store.byMode(mode);
  }

  groupedByCategory(): { category: string; sources: BlotterSource[] }[] {
    // Read the version signal so computeds built on this method (e.g. the blotter's
    // pickerGroups) re-evaluate after ad-hoc CRUD and the async catalog load.
    this.version();
    return this.store.groupedByCategory();
  }

  addAdhoc(src: Omit<BlotterSource, 'id' | 'origin'>): BlotterSource {
    return this.store.addAdhoc(src);
  }

  updateAdhoc(src: BlotterSource): void {
    this.store.updateAdhoc(src);
  }

  removeAdhoc(id: string): void {
    this.store.removeAdhoc(id);
  }
}
