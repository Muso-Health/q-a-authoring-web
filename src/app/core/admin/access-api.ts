import { Service, inject } from '@angular/core';
import { ApiPort } from '../api/api-port';
import { toAssignment, toGrant, type Assignment, type Grant } from '../access/scoped-access';
import type { Schemas } from '../api/api-types';

/** A user as the administration shows them — never their identity-provider subject. */
export interface AdminUser {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
  readonly active: boolean;
  readonly assignments: readonly Assignment[];
  readonly grants: readonly Grant[];
}

/** What to assign: a role, in a project and a language — null for any. */
export interface AssignmentDraft {
  readonly roleId: string;
  readonly projectId: string | null;
  readonly languageId: string | null;
}

export interface AdminRole {
  readonly id: string;
  readonly name: string;
  readonly permissions: readonly string[];
}

export interface UserChange {
  readonly displayName?: string;
  readonly active?: boolean;
}

// Field by field, so nothing the engine adds to a user ever reaches a template.
const toUser = (raw: Schemas['UserResponse']): AdminUser => ({
  id: raw.id,
  email: raw.email,
  displayName: raw.display_name,
  active: raw.is_active,
  assignments: raw.assignments.map(toAssignment),
  grants: raw.grants.map(toGrant),
});

const toRole = (raw: Schemas['RoleResponse']): AdminRole => ({
  id: raw.id,
  name: raw.name,
  permissions: raw.permissions,
});

/** Users, roles and the fixed permission catalogue roles are built from. */
@Service()
export class AccessApi {
  readonly #api = inject(ApiPort);

  async users(): Promise<AdminUser[]> {
    const { items } = await this.#api.get<Schemas['UsersResponse']>('/users');
    return items.map(toUser);
  }

  async createUser(email: string, displayName: string): Promise<void> {
    const body: Schemas['CreateUserRequest'] = { email, display_name: displayName };
    await this.#api.post('/users', body);
  }

  /** There is no deletion: `active: false` deactivates. */
  async updateUser(userId: string, change: UserChange): Promise<void> {
    const body: Schemas['UpdateUserRequest'] = {};
    if (change.displayName !== undefined) body.display_name = change.displayName;
    if (change.active !== undefined) body.is_active = change.active;
    await this.#api.patch(`/users/${userId}`, body);
  }

  /**
   * Idempotent on the engine's side: 201 when new, 200 when the user already held the role in
   * exactly that scope — both are success. The nulls are sent, not omitted, so "any" is said.
   */
  async assign(userId: string, draft: AssignmentDraft): Promise<void> {
    const body: Schemas['AssignRoleRequest'] = {
      role_id: draft.roleId,
      project_id: draft.projectId,
      language_id: draft.languageId,
    };
    await this.#api.post(`/users/${userId}/assignments`, body);
  }

  /** By the assignment's own id: a role may be held in several scopes at once. */
  async unassign(userId: string, assignmentId: string): Promise<void> {
    await this.#api.delete(`/users/${userId}/assignments/${assignmentId}`);
  }

  async roles(): Promise<AdminRole[]> {
    const { items } = await this.#api.get<Schemas['RolesResponse']>('/roles');
    return items.map(toRole);
  }

  async createRole(name: string, permissions: readonly string[]): Promise<void> {
    const body: Schemas['CreateRoleRequest'] = { name, permissions: [...permissions] };
    await this.#api.post('/roles', body);
  }

  /** `permissions` replaces the whole set. */
  async updateRole(roleId: string, name: string, permissions: readonly string[]): Promise<void> {
    const body: Schemas['UpdateRoleRequest'] = { name, permissions: [...permissions] };
    await this.#api.patch(`/roles/${roleId}`, body);
  }

  async deleteRole(roleId: string): Promise<void> {
    await this.#api.delete(`/roles/${roleId}`);
  }

  async permissions(): Promise<string[]> {
    return (await this.#api.get<Schemas['PermissionsResponse']>('/permissions')).items;
  }
}
