import { Route } from '@angular/router';
import { SourceCatalogComponent } from './components/source-catalog/source-catalog.component';
import { BlotterComponent } from './components/blotter/blotter.component';

export const appRoutes: Route[] = [
  // The blotter is the primary surface: a fresh instance lands here and shows the source picker
  // empty state. The full catalog stays available at /sources for browsing/managing all sources.
  { path: 'blotter', component: BlotterComponent },
  { path: 'sources', component: SourceCatalogComponent },
  { path: '', redirectTo: 'blotter', pathMatch: 'full' },
];
