import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./rates-execution-blotter/rates-execution-blotter.component').then(m => m.RatesExecutionBlotterComponent),
  },
  { path: '**', redirectTo: '' },
];
