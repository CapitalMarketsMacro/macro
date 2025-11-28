import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { WorkspaceService, ThemeService } from '@macro/openfin';

@Component({
  selector: 'app-provider',
  template: `
    <div class="col fill gap20">
      <header class="row spread middle">
        <div class="col">
          <h1>OpenFin Platform Window</h1>
          <h1 class="tag">Workspace platform window</h1>
        </div>
        <div class="row middle gap10">
          <img src="logo.svg" alt="OpenFin" height="40px" />
        </div>
      </header>
      <main class="col gap10">
        <p>This window initializes the OpenFin Workspace platform.</p>
        <p>You can hide it by setting platform.autoShow=false in manifest.fin.json.</p>
        <p class="message" style="color: orange">Status: {{ message$ | async }}</p>
      </main>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
})
export class ProviderComponent implements OnInit, OnDestroy {
  private readonly workspaceService = inject(WorkspaceService);
  private readonly themeService = inject(ThemeService);
  private readonly unsubscribe$ = new Subject<void>();

  readonly message$ = this.workspaceService.getStatus$();

  ngOnInit(): void {
    // Initialize theme service to sync with OpenFin theme
    this.themeService.syncWithOpenFinTheme();

    this.workspaceService
      .init()
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe();
  }

  ngOnDestroy(): void {
    this.themeService.stopSyncing();
    this.workspaceService.quit();
    this.unsubscribe$.next();
    this.unsubscribe$.complete();
  }
}
