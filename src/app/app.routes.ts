import type { Routes } from '@angular/router';
import { Shell } from './layout/shell';

export const routes: Routes = [
  {
    path: '',
    component: Shell,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'projects' },
      {
        path: 'projects',
        loadComponent: () =>
          import('./features/projects/projects-page').then((m) => m.ProjectsPage),
      },
      {
        path: 'projects/:projectId',
        loadComponent: () => import('./features/project/project-page').then((m) => m.ProjectPage),
      },
      {
        path: 'protocols/:protocolId',
        loadComponent: () =>
          import('./features/protocol/protocol-page').then((m) => m.ProtocolPage),
      },
      {
        path: 'themes/:themeId',
        loadComponent: () => import('./features/theme/theme-page').then((m) => m.ThemePage),
      },
      {
        path: 'qasets/:qasetId',
        loadComponent: () => import('./features/qaset/qaset-page').then((m) => m.QASetPage),
      },
      {
        path: 'status',
        loadComponent: () =>
          import('./features/engine-status/engine-status').then((m) => m.EngineStatus),
      },
      { path: '**', redirectTo: 'projects' },
    ],
  },
];
