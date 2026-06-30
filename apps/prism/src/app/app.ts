import { Component, inject } from '@angular/core';
import { RouterOutlet, RouterLink } from '@angular/router';
import { Menubar } from 'primeng/menubar';
import { ButtonModule } from 'primeng/button';
import { MenuItem } from 'primeng/api';
import { ThemeService } from '@macro/macro-design/angular';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, Menubar, ButtonModule],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  /** Shared macro ThemeService (default 'macro' theme; syncs system + OpenFin). */
  protected readonly theme = inject(ThemeService);

  protected readonly menuItems: MenuItem[] = [
    { label: 'Blotter', icon: 'pi pi-table', routerLink: '/blotter' },
    { label: 'Catalog', icon: 'pi pi-database', routerLink: '/sources' },
  ];

  get isDark(): boolean {
    return this.theme.isDark();
  }

  toggleTheme(): void {
    this.theme.toggle();
  }
}
