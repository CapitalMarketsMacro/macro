import { Route } from '@angular/router';
import { InstrumentViewerComponent } from './instrument-viewer/instrument-viewer.component';

export const appRoutes: Route[] = [
  {
    path: 'instrument-viewer',
    component: InstrumentViewerComponent,
  },
  {
    path: '',
    redirectTo: '/instrument-viewer',
    pathMatch: 'full',
  },
];
