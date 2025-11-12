import { Route } from '@angular/router';
import { FxMarketDataComponent } from './fx-market-data/fx-market-data.component';
import { TreasuryMicrostructureComponent } from './treasury-microstructure/treasury-microstructure.component';

export const appRoutes: Route[] = [
  {
    path: 'fx-market-data',
    component: FxMarketDataComponent,
  },
  {
    path: 'treasury-microstructure',
    component: TreasuryMicrostructureComponent,
  },
  {
    path: '',
    redirectTo: '/fx-market-data',
    pathMatch: 'full',
  },
];
