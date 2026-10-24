import type { Routes } from '@angular/router';
import { MANAGE_ACCESS, MANAGE_PROMPTS } from '../../core/access/current-user';
import { permissionGuard } from '../../core/access/permission-guard';
import { AdminArea } from './admin-area';
import { firstAdminSection } from './admin-sections';

export const ADMIN_ROUTES: Routes = [
  {
    path: '',
    component: AdminArea,
    children: [
      { path: '', pathMatch: 'full', canActivate: [firstAdminSection], children: [] },
      {
        path: 'prompts',
        canMatch: [permissionGuard(MANAGE_PROMPTS)],
        loadComponent: () =>
          import('./prompts/prompt-templates-page').then((m) => m.PromptTemplatesPage),
      },
      {
        path: 'prompts/:key',
        canMatch: [permissionGuard(MANAGE_PROMPTS)],
        loadComponent: () =>
          import('./prompts/prompt-template-page').then((m) => m.PromptTemplatePage),
      },
      {
        path: 'users',
        canMatch: [permissionGuard(MANAGE_ACCESS)],
        loadComponent: () => import('./users/users-page').then((m) => m.UsersPage),
      },
      {
        path: 'roles',
        canMatch: [permissionGuard(MANAGE_ACCESS)],
        loadComponent: () => import('./roles/roles-page').then((m) => m.RolesPage),
      },
    ],
  },
];
