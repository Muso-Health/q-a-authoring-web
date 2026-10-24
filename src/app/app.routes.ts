import type { Routes } from '@angular/router';
import { Shell } from './layout/shell';

export const routes: Routes = [
  {
    path: '',
    component: Shell,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'status' },
      {
        path: 'status',
        loadComponent: () =>
          import('./features/engine-status/engine-status').then((m) => m.EngineStatus),
      },
      { path: '**', redirectTo: 'status' },
    ],
  },
];
