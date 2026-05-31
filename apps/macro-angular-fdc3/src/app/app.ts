import { Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Logger, LogLevel } from '@macro/logger';
import { ThemeService } from '@macro/macro-design/angular';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
  standalone: true,
  imports: [RouterOutlet],
})
export class App implements OnInit {
  private logger = Logger.getLogger('AngularFdc3App');

  // Activate the shared macro ThemeService (default 'macro'; applies dark/light
  // and syncs with the OS and the OpenFin platform). Injecting it is enough.
  protected readonly theme = inject(ThemeService);

  ngOnInit(): void {
    Logger.setGlobalLevel(LogLevel.DEBUG);
    this.logger.info('FDC3 Instrument Viewer initialized');
  }
}
