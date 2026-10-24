import { Service, inject } from '@angular/core';
import { ApiPort } from '../api/api-port';
import type { Schemas } from '../api/api-types';

export interface RoleRef {
  readonly id: string;
  readonly name: string;
}

/** A user as the administration shows them — never their identity-provider subject. */
export interface AdminUser {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
  readonly active: boolean;
  readonly roles: readonly RoleRef[];
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
  roles: raw.roles.map(({ id, name }) => ({ id, name })),
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

  async assignRole(userId: string, roleId: string): Promise<void> {
    const body: Schemas['AssignRoleRequest'] = { role_id: roleId };
    await this.#api.post(`/users/${userId}/roles`, body);
  }

  async unassignRole(userId: string, roleId: string): Promise<void> {
    await this.#api.delete(`/users/${userId}/roles/${roleId}`);
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
