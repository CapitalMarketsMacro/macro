import { Route } from '@angular/router';
import { FxMarketDataComponent } from './fx-market-data/fx-market-data.component';
import { TreasuryMicrostructureComponent } from './treasury-microstructure/treasury-microstructure.component';
import { RiskPnlComponent } from './risk-pnl/risk-pnl.component';

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
    path: 'risk-pnl',
    component: RiskPnlComponent,
  },
  {
    path: '',
    redirectTo: '/fx-market-data',
    pathMatch: 'full',
  },
];
