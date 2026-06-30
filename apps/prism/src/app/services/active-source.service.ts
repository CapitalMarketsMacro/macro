import { Injectable, signal } from '@angular/core';
import type { BlotterSource } from '../models/blotter-source';

/**
 * Holds the source the user is opening, so the catalog/dialog can hand it to the blotter route
 * without serializing the whole source through the URL (the URL only carries `?source=<id>` for
 * deep links into catalog/ad-hoc sources).
 */
@Injectable({ providedIn: 'root' })
export class ActiveSourceService {
  readonly active = signal<BlotterSource | null>(null);

  open(source: BlotterSource): void {
    this.active.set(source);
  }

  clear(): void {
    this.active.set(null);
  }
}
