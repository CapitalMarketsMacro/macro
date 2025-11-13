import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'provider',
    loadComponent: () => import('./provider/provider.component').then((m) => m.ProviderComponent),
  },
  {
    path: 'view1',
    loadComponent: () => import('./view1/view1.component').then((m) => m.View1Component),
  },
  {
    path: 'view2',
    loadComponent: () => import('./view2/view2.component').then((m) => m.View2Component),
  },
  { path: '', pathMatch: 'full', redirectTo: 'provider' },
  { path: '**', redirectTo: 'provider' },
];
