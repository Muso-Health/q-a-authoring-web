import { Injectable, inject, resource } from '@angular/core';
import { AccessApi, type UserChange } from '../../../core/admin/access-api';
import { AdminWrites, reread } from '../admin-writes';

export const CREATE_USER = 'create';
export const userTarget = (userId: string) => `user:${userId}`;

/** The users page's state: the users, the roles to hand out, and every write, each re-reading. */
@Injectable()
export class UserDirectory {
  readonly #api = inject(AccessApi);
  readonly writes = inject(AdminWrites);

  readonly users = resource({ loader: () => this.#api.users() });
  readonly roles = resource({ loader: () => this.#api.roles() });

  create(email: string, displayName: string): Promise<boolean> {
    return this.#write(CREATE_USER, () => this.#api.createUser(email, displayName));
  }

  update(userId: string, change: UserChange): Promise<boolean> {
    return this.#write(userTarget(userId), () => this.#api.updateUser(userId, change));
  }

  assign(userId: string, roleId: string): Promise<boolean> {
    return this.#write(userTarget(userId), () => this.#api.assignRole(userId, roleId));
  }

  unassign(userId: string, roleId: string): Promise<boolean> {
    return this.#write(userTarget(userId), () => this.#api.unassignRole(userId, roleId));
  }

  #write(target: string, call: () => Promise<void>): Promise<boolean> {
    return this.writes.run(target, call, () => reread(this.users, () => this.#api.users()));
  }
}
