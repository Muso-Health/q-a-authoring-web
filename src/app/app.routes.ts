import type { Routes } from '@angular/router';
import {
  ADMIN_PERMISSIONS,
  VALIDATE_AUDIO,
  VALIDATE_CLINICAL,
  VALIDATE_TRANSLATION,
} from './core/access/current-user';
import { permissionGuard } from './core/access/permission-guard';
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
      ...(
        [
          ['clinical', VALIDATE_CLINICAL],
          ['translation', VALIDATE_TRANSLATION],
          ['audio', VALIDATE_AUDIO],
        ] as const
      ).map(([kind, permission]) => ({
        path: `validation/${kind}`,
        canMatch: [permissionGuard(permission)],
        data: { kind },
        loadComponent: () =>
          import('./features/validation/validation-page').then((m) => m.ValidationPage),
      })),
      {
        path: 'admin',
        canMatch: [permissionGuard(...ADMIN_PERMISSIONS)],
        loadChildren: () => import('./features/admin/admin.routes').then((m) => m.ADMIN_ROUTES),
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
