import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { CurrentUser, MANAGE_ACCESS, MANAGE_PROMPTS } from '../../core/access/current-user';

export interface AdminSection {
  readonly path: string;
  readonly label: string;
  readonly permission: string;
}

export const ADMIN_SECTIONS: readonly AdminSection[] = [
  { path: 'prompts', label: 'admin.nav.prompts', permission: MANAGE_PROMPTS },
  { path: 'users', label: 'admin.nav.users', permission: MANAGE_ACCESS },
  { path: 'roles', label: 'admin.nav.roles', permission: MANAGE_ACCESS },
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
