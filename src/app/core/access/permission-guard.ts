import { inject } from '@angular/core';
import { Router, type CanMatchFn } from '@angular/router';
import { CurrentUser } from './current-user';

/** A route for holders of one permission; anyone else lands on the projects. */
export function permissionGuard(permission: string): CanMatchFn {
  return async () => {
    const router = inject(Router);
    return (await inject(CurrentUser).has(permission)) || router.createUrlTree(['/projects']);
  };
}
