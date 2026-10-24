import { inject } from '@angular/core';
import { Router, type CanMatchFn } from '@angular/router';
import { CurrentUser } from './current-user';

/** A route for holders of any of the permissions; anyone else lands on the projects. */
export function permissionGuard(...permissions: string[]): CanMatchFn {
  return async () => {
    const router = inject(Router);
    const user = inject(CurrentUser);
    const held = await Promise.all(permissions.map((permission) => user.has(permission)));
    return held.includes(true) || router.createUrlTree(['/projects']);
  };
}
