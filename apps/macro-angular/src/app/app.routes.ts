import { Route } from '@angular/router';
import { FxMarketDataComponent } from './fx-market-data/fx-market-data.component';

export const appRoutes: Route[] = [
  {
    path: 'fx-market-data',
    component: FxMarketDataComponent,
  },
  {
    path: '',
    redirectTo: '/fx-market-data',
    pathMatch: 'full',
  },
];
