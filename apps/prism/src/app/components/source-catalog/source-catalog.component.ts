import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Card } from 'primeng/card';
import { Tag } from 'primeng/tag';
import { Button } from 'primeng/button';
import { SelectButton } from 'primeng/selectbutton';
import { DataSourceRepository } from '../../services/data-source-repository.service';
import { ActiveSourceService } from '../../services/active-source.service';
import { AdHocSourceDialogComponent } from '../adhoc-source-dialog/adhoc-source-dialog.component';
import {
  MODE_LABELS,
  TRANSPORT_LABELS,
  type BlotterMode,
  type BlotterSource,
} from '../../models/blotter-source';

type GroupBy = 'category' | 'transport' | 'mode';

@Component({
  selector: 'app-source-catalog',
  standalone: true,
  imports: [RouterLink, FormsModule, Card, Tag, Button, SelectButton, AdHocSourceDialogComponent],
  templateUrl: './source-catalog.component.html',
  styleUrl: './source-catalog.component.css',
})
export class SourceCatalogComponent {
  private readonly repo = inject(DataSourceRepository);
  private readonly activeSource = inject(ActiveSourceService);
  private readonly router = inject(Router);

  private readonly dialog = viewChild.required(AdHocSourceDialogComponent);

  readonly transportLabels = TRANSPORT_LABELS;
  readonly modeLabels = MODE_LABELS;

  readonly groupByOptions = [
    { label: 'Category', value: 'category' as GroupBy },
    { label: 'Type', value: 'transport' as GroupBy },
    { label: 'Behavior', value: 'mode' as GroupBy },
  ];
  readonly groupBy = signal<GroupBy>('category');

  readonly groups = computed(() => this.buildGroups(this.groupBy(), this.repo.all()));

  open(src: BlotterSource): void {
    this.activeSource.open(src);
    this.router.navigate(['/blotter'], { queryParams: { source: src.id } });
  }

  addAdhoc(): void {
    this.dialog().show();
  }

  edit(src: BlotterSource): void {
    this.dialog().show(src);
  }

  remove(src: BlotterSource): void {
    this.repo.removeAdhoc(src.id);
  }

  onSaved(src: BlotterSource): void {
    this.open(src);
  }

  modeSeverity(mode: BlotterMode): 'success' | 'warn' | 'danger' {
    return mode === 'streaming' ? 'danger' : mode === 'append' ? 'warn' : 'success';
  }

  private buildGroups(by: GroupBy, sources: BlotterSource[]): { title: string; sources: BlotterSource[] }[] {
    if (by === 'category') {
      return this.repo.groupedByCategory().map((g) => ({ title: g.category, sources: g.sources }));
    }
    const labels: Record<string, string> = by === 'transport' ? this.transportLabels : this.modeLabels;
    const map = new Map<string, BlotterSource[]>();
    for (const s of sources) {
      const key = by === 'transport' ? s.transport : s.mode;
      const list = map.get(key) ?? [];
      list.push(s);
      map.set(key, list);
    }
    return [...map.entries()].map(([key, list]) => ({ title: labels[key] ?? key, sources: list }));
  }
}
