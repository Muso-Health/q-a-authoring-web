import { Injectable, inject, resource } from '@angular/core';
import { AccessApi, type AssignmentDraft, type UserChange } from '../../../core/admin/access-api';
import { TaxonomyAdminApi } from '../../../core/admin/taxonomy-admin-api';
import { CatalogApi } from '../../../core/catalog/catalog-api';
import { AdminWrites, reread } from '../admin-writes';

export const CREATE_USER = 'create';
export const userTarget = (userId: string) => `user:${userId}`;

/**
 * The users page's state: the users, and what an assignment is made of — the roles, and the
 * projects and languages that scope them — plus every write, each re-reading.
 */
@Injectable()
export class UserDirectory {
  readonly #api = inject(AccessApi);
  readonly #catalog = inject(CatalogApi);
  readonly #taxonomy = inject(TaxonomyAdminApi);
  readonly writes = inject(AdminWrites);

  readonly users = resource({ loader: () => this.#api.users() });
  readonly roles = resource({ loader: () => this.#api.roles() });
  readonly projects = resource({ loader: () => this.#catalog.projects() });
  readonly languages = resource({ loader: () => this.#taxonomy.languages() });

  create(email: string, displayName: string): Promise<boolean> {
    return this.#write(CREATE_USER, () => this.#api.createUser(email, displayName));
  }

  update(userId: string, change: UserChange): Promise<boolean> {
    return this.#write(userTarget(userId), () => this.#api.updateUser(userId, change));
  }

  /**
   * Re-reads the choices as well as the users: a refusal here is most often a role, project or
   * language someone else just deleted, and the pickers must stop offering it.
   */
  assign(userId: string, draft: AssignmentDraft): Promise<boolean> {
    return this.writes.run(
      userTarget(userId),
      () => this.#api.assign(userId, draft),
      () =>
        Promise.all([
          reread(this.users, () => this.#api.users()),
          reread(this.roles, () => this.#api.roles()),
          reread(this.projects, () => this.#catalog.projects()),
          reread(this.languages, () => this.#taxonomy.languages()),
        ]),
    );
  }

  unassign(userId: string, assignmentId: string): Promise<boolean> {
    return this.#write(userTarget(userId), () => this.#api.unassign(userId, assignmentId));
  }

  #write(target: string, call: () => Promise<void>): Promise<boolean> {
    return this.writes.run(target, call, () => reread(this.users, () => this.#api.users()));
  }
}
