import { Component, computed, inject, resource, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { AccessApi, type AdminRole } from '../../../core/admin/access-api';
import { Translator } from '../../../core/i18n/translator';
import { ConfirmAction } from '../../../shared/ui/confirm-action';
import { FocusReturn, FocusReturnTarget } from '../../../shared/ui/focus-return';
import { LoadError, Loading } from '../../../shared/ui/load-state';
import { AdminWrites, reread } from '../admin-writes';
import { RoleForm, type RoleDraft } from './role-form';

const CREATE = 'create';
const roleTarget = (roleId: string) => `role:${roleId}`;
const EMPTY: RoleDraft = { name: '', permissions: [] };

/** Roles as named sets of permissions from the engine's fixed catalogue. */
@Component({
  selector: 'app-roles-page',
  imports: [TranslocoPipe, Loading, LoadError, RoleForm, ConfirmAction, FocusReturnTarget],
  providers: [AdminWrites],
  template: `
    <h2>{{ 'admin.roles.title' | transloco }}</h2>

    <section class="muso-card" aria-labelledby="create-role-heading">
      <h3 id="create-role-heading">{{ 'admin.roles.create' | transloco }}</h3>
      <app-role-form
        mode="create"
        [initial]="createSeed()"
        [catalogue]="catalogue()"
        [labelOf]="labelOf()"
        [busy]="writes.busy()"
        [error]="writes.errorFor(createTarget)"
        (save)="create($event)"
      />
    </section>

    <div aria-live="polite">
      @if (writes.notice(); as notice) {
        <p class="page-notice muso-notice">{{ notice }}</p>
      }
    </div>

    @if (roles.hasValue()) {
      @if (roles.value().length > 0) {
        <ul class="muso-cards">
          @for (role of roles.value(); track role.id) {
            <li class="role muso-card">
              <h3>{{ role.name }}</h3>
              @if (editing() === role.id) {
                <app-role-form
                  mode="edit"
                  [initial]="role"
                  [catalogue]="catalogue()"
                  [labelOf]="labelOf()"
                  [busy]="writes.busy()"
                  [error]="writes.errorFor(target(role.id))"
                  (save)="update(role, $event)"
                  (cancel)="closeEdit(role.id)"
                />
              } @else {
                @if (role.permissions.length > 0) {
                  <ul
                    class="permissions muso-chips"
                    [attr.aria-label]="'admin.roles.permissions' | transloco"
                  >
                    @for (code of role.permissions; track code) {
                      <li>{{ labelOf()(code) }}</li>
                    }
                  </ul>
                } @else {
                  <p class="muso-meta">{{ 'admin.roles.noPermission' | transloco }}</p>
                }
                @if (writes.errorFor(target(role.id)); as message) {
                  <p class="field-error" role="alert">{{ message }}</p>
                }
                <div class="actions">
                  <button
                    type="button"
                    class="secondary small"
                    [appFocusReturn]="'edit-role:' + role.id"
                    [disabled]="writes.busy()"
                    [attr.aria-label]="'admin.roles.editName' | transloco: { role: role.name }"
                    (click)="openEdit(role.id)"
                  >
                    {{ 'admin.roles.edit' | transloco }}
                  </button>
                  <app-confirm-action
                    [small]="true"
                    [label]="'admin.roles.delete' | transloco"
                    [accessibleName]="'admin.roles.deleteName' | transloco: { role: role.name }"
                    [warning]="'admin.roles.deleteWarning' | transloco: { role: role.name }"
                    [busy]="writes.busy()"
                    (confirmed)="remove(role.id)"
                  />
                </div>
              }
            </li>
          }
        </ul>
      } @else {
        <p class="muso-empty">{{ 'admin.roles.empty' | transloco }}</p>
      }
    } @else if (roles.error()) {
      <app-load-error [error]="roles.error()" (retry)="roles.reload()" />
    } @else {
      <app-loading />
    }
  `,
  styles: `
    h3 {
      margin-block: 0 var(--muso-space-1);
      font-size: var(--muso-body-lg-size);
    }
    .role {
      display: grid;
      gap: var(--muso-space-1);
    }
    .muso-chips {
      margin: 0;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: var(--muso-space-1);
    }
  `,
})
export class RolesPage {
  readonly #api = inject(AccessApi);
  readonly #translator = inject(Translator);
  readonly #focus = inject(FocusReturn);
  protected readonly writes = inject(AdminWrites);
  protected readonly createTarget = CREATE;

  protected readonly roles = resource({ loader: () => this.#api.roles() });
  readonly #permissions = resource({ loader: () => this.#api.permissions() });
  protected readonly catalogue = computed(() =>
    this.#permissions.hasValue() ? this.#permissions.value() : [],
  );

  /** A permission in words; a code the UI has no words for shows as itself. */
  protected readonly labelOf = computed(() => {
    this.#translator.language();
    return (code: string) => {
      const key = `admin.permissions.${code}`;
      const words = this.#translator.t(key);
      return words === key ? code : words;
    };
  });

  protected readonly createSeed = signal<RoleDraft>(EMPTY);
  protected readonly editing = signal<string | null>(null);

  protected target(roleId: string): string {
    return roleTarget(roleId);
  }

  protected async create(draft: RoleDraft): Promise<void> {
    if (await this.#write(CREATE, () => this.#api.createRole(draft.name, draft.permissions))) {
      this.createSeed.set({ ...EMPTY });
    }
  }

  protected async update(role: AdminRole, draft: RoleDraft): Promise<void> {
    const call = () => this.#api.updateRole(role.id, draft.name, draft.permissions);
    if (await this.#write(roleTarget(role.id), call)) this.closeEdit(role.id);
  }

  protected remove(roleId: string): void {
    void this.#write(roleTarget(roleId), () => this.#api.deleteRole(roleId));
  }

  protected openEdit(roleId: string): void {
    this.writes.clearError(roleTarget(roleId));
    this.editing.set(roleId);
  }

  protected closeEdit(roleId: string): void {
    this.editing.set(null);
    this.writes.clearError(roleTarget(roleId));
    this.#focus.to(`edit-role:${roleId}`);
  }

  #write(target: string, call: () => Promise<void>): Promise<boolean> {
    return this.writes.run(target, call, () => reread(this.roles, () => this.#api.roles()));
  }
}
