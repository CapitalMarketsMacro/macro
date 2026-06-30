import { Route } from '@angular/router';
import { SourceCatalogComponent } from './components/source-catalog/source-catalog.component';
import { BlotterComponent } from './components/blotter/blotter.component';

export const appRoutes: Route[] = [
  { path: 'sources', component: SourceCatalogComponent },
  { path: 'blotter', component: BlotterComponent },
  { path: '', redirectTo: 'sources', pathMatch: 'full' },
];
