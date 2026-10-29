import type { Routes } from '@angular/router';
import {
  MANAGE_ACCESS,
  MANAGE_CATALOG,
  MANAGE_CATEGORIES,
  MANAGE_INTENTS,
  MANAGE_LANGUAGES,
  MANAGE_PROMPTS,
  MANAGE_VOICES,
} from '../../core/access/current-user';
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
      // The catalogue's levels: the projects, a project's protocols, a protocol's themes.
      ...['catalog', 'catalog/projects/:projectId', 'catalog/protocols/:protocolId'].map(
        (path) => ({
          path,
          canMatch: [permissionGuard(MANAGE_CATALOG)],
          loadComponent: () => import('./catalog/catalog-page').then((m) => m.CatalogPage),
        }),
      ),
      {
        path: 'languages',
        canMatch: [permissionGuard(MANAGE_LANGUAGES)],
        loadComponent: () => import('./languages/languages-page').then((m) => m.LanguagesPage),
      },
      {
        path: 'voices',
        canMatch: [permissionGuard(MANAGE_VOICES)],
        loadComponent: () => import('./voices/voices-page').then((m) => m.VoicesPage),
      },
      ...(
        [
          ['intents', MANAGE_INTENTS],
          ['categories', MANAGE_CATEGORIES],
        ] as const
      ).map(([kind, permission]) => ({
        path: kind,
        canMatch: [permissionGuard(permission)],
        data: { kind },
        loadComponent: () => import('./terms/terms-page').then((m) => m.TermsPage),
      })),
      // Read by anyone in the area; the page offers its writes to whoever manages the glossary.
      {
        path: 'glossary',
        loadComponent: () => import('./glossary/glossary-page').then((m) => m.GlossaryPage),
      },
    ],
  },
];
