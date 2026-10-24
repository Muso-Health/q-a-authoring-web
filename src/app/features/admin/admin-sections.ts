import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import {
  CurrentUser,
  MANAGE_ACCESS,
  MANAGE_CATALOG,
  MANAGE_CATEGORIES,
  MANAGE_INTENTS,
  MANAGE_LANGUAGES,
  MANAGE_PROMPTS,
} from '../../core/access/current-user';

export interface AdminSection {
  readonly path: string;
  readonly label: string;
  readonly permission: string;
}

export const ADMIN_SECTIONS: readonly AdminSection[] = [
  { path: 'prompts', label: 'admin.nav.prompts', permission: MANAGE_PROMPTS },
  { path: 'users', label: 'admin.nav.users', permission: MANAGE_ACCESS },
  { path: 'roles', label: 'admin.nav.roles', permission: MANAGE_ACCESS },
  { path: 'catalog', label: 'admin.nav.catalog', permission: MANAGE_CATALOG },
  { path: 'languages', label: 'admin.nav.languages', permission: MANAGE_LANGUAGES },
  { path: 'intents', label: 'admin.nav.intents', permission: MANAGE_INTENTS },
  { path: 'categories', label: 'admin.nav.categories', permission: MANAGE_CATEGORIES },
];

/** `/admin` itself opens the first section the user may see. */
export const firstAdminSection: CanActivateFn = async () => {
  const router = inject(Router);
  const user = inject(CurrentUser);
  for (const section of ADMIN_SECTIONS) {
    if (await user.has(section.permission)) return router.createUrlTree(['/admin', section.path]);
  }
  return router.createUrlTree(['/projects']);
};
