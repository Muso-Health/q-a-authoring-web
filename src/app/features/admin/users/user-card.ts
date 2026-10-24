import { Component, computed, inject, input, signal } from '@angular/core';
import { FormField, form, requiredError, validate } from '@angular/forms/signals';
import { TranslocoPipe } from '@jsverse/transloco';
import type { AdminUser } from '../../../core/admin/access-api';
import { ConfirmAction } from '../../../shared/ui/confirm-action';
import { FocusReturn, FocusReturnTarget } from '../../../shared/ui/focus-return';
import { UserDirectory, userTarget } from './user-directory';

let nextId = 0;

/** One user: rename, (de)activate — never delete — and hand out or take back roles. */
@Component({
  selector: 'app-user-card',
  imports: [FormField, TranslocoPipe, ConfirmAction, FocusReturnTarget],
  template: `
    @let it = user();
    <div class="head">
      <h3>{{ it.displayName }}</h3>
      <span class="state" [class.inactive]="!it.active">
        {{ (it.active ? 'admin.users.active' : 'admin.users.inactive') | transloco }}
      </span>
    </div>
    <p class="email">{{ it.email }}</p>

    @if (renaming()) {
      <form novalidate class="rename" (submit)="rename($event)">
        <label [for]="id + '-name'">{{ 'admin.users.displayName' | transloco }}</label>
        <input
          type="text"
          [id]="id + '-name'"
          [formField]="nameForm.displayName"
          [attr.aria-invalid]="nameBlank() ? 'true' : null"
        />
        @if (nameBlank()) {
          <p class="field-error">{{ 'admin.required' | transloco }}</p>
        }
        <div class="actions">
          <button type="submit" [disabled]="directory.writes.busy()">
            {{ 'authoring.save' | transloco }}
          </button>
          <button type="button" class="secondary" (click)="closeRename()">
            {{ 'authoring.cancel' | transloco }}
          </button>
        </div>
      </form>
    }

    <h4 class="muso-meta">{{ 'admin.users.roles' | transloco }}</h4>
    @if (it.roles.length > 0) {
      <ul class="roles muso-chips">
        @for (role of it.roles; track role.id) {
          <li>
            <span class="role-name">{{ role.name }}</span>
            <button
              type="button"
              class="chip-remove"
              [disabled]="directory.writes.busy()"
              [attr.aria-label]="
                'admin.users.unassign' | transloco: { role: role.name, user: it.displayName }
              "
              (click)="directory.unassign(it.id, role.id)"
            >
              <span aria-hidden="true">×</span>
            </button>
          </li>
        }
      </ul>
    } @else {
      <p class="muso-meta">{{ 'admin.users.noRole' | transloco }}</p>
    }

    @if (assignable().length > 0) {
      <form novalidate class="assign" (submit)="assign($event)">
        <label [for]="id + '-role'">{{ 'admin.users.assign' | transloco }}</label>
        <div class="inline">
          <select [id]="id + '-role'" [formField]="roleForm.roleId">
            <option value="">{{ 'admin.users.chooseRole' | transloco }}</option>
            @for (role of assignable(); track role.id) {
              <option [value]="role.id">{{ role.name }}</option>
            }
          </select>
          <button type="submit" class="secondary" [disabled]="directory.writes.busy()">
            {{ 'admin.users.assignSubmit' | transloco }}
          </button>
        </div>
        @if (roleMissing()) {
          <p class="field-error">{{ 'admin.users.roleRequired' | transloco }}</p>
        }
      </form>
    }

    @if (directory.writes.errorFor(target()); as message) {
      <p class="field-error" role="alert">{{ message }}</p>
    }

    <div class="actions">
      @if (!renaming()) {
        <button
          type="button"
          class="secondary small"
          [appFocusReturn]="'rename:' + it.id"
          [disabled]="directory.writes.busy()"
          [attr.aria-label]="'admin.users.renameName' | transloco: { user: it.displayName }"
          (click)="openRename()"
        >
          {{ 'admin.users.rename' | transloco }}
        </button>
      }
      @if (it.active) {
        <app-confirm-action
          [small]="true"
          [label]="'admin.users.deactivate' | transloco"
          [accessibleName]="'admin.users.deactivateName' | transloco: { user: it.displayName }"
          [warning]="'admin.users.deactivateWarning' | transloco: { user: it.displayName }"
          [busy]="directory.writes.busy()"
          (confirmed)="directory.update(it.id, { active: false })"
        />
      } @else {
        <button
          type="button"
          class="secondary small"
          [disabled]="directory.writes.busy()"
          [attr.aria-label]="'admin.users.reactivateName' | transloco: { user: it.displayName }"
          (click)="directory.update(it.id, { active: true })"
        >
          {{ 'admin.users.reactivate' | transloco }}
        </button>
      }
    </div>
  `,
  styles: `
    :host {
      display: grid;
      gap: var(--muso-space-1);
    }
    .head {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: var(--muso-space-2);
    }
    h3 {
      margin: 0;
      font-size: var(--muso-body-lg-size);
    }
    h4 {
      margin: var(--muso-space-1) 0 0;
      font-weight: 600;
    }
    p {
      margin: 0;
    }
    .email {
      overflow-wrap: anywhere;
    }
    .state {
      padding: 0.1rem var(--muso-space-2);
      border-radius: 999px;
      background: var(--muso-teal-12);
      font-size: var(--muso-caption-size);
      font-weight: 600;
    }
    .state.inactive {
      background: var(--surface-alt);
      color: var(--muted-fg);
    }
    .muso-chips {
      margin: 0;
    }
    .inline {
      display: flex;
      flex-wrap: wrap;
      gap: var(--muso-space-1);
    }
    .inline select {
      flex: 1 1 12rem;
      inline-size: auto;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: var(--muso-space-1);
    }
  `,
})
export class UserCard {
  protected readonly directory = inject(UserDirectory);
  readonly #focus = inject(FocusReturn);
  protected readonly id = `user-card-${nextId++}`;

  readonly user = input.required<AdminUser>();

  protected readonly target = computed(() => userTarget(this.user().id));
  protected readonly assignable = computed(() => {
    const held = new Set(this.user().roles.map((role) => role.id));
    const roles = this.directory.roles.hasValue() ? this.directory.roles.value() : [];
    return roles.filter((role) => !held.has(role.id));
  });

  protected readonly renaming = signal(false);
  readonly #nameTried = signal(false);
  readonly #name = signal({ displayName: '' });
  protected readonly nameForm = form(this.#name, (path) => {
    validate(path.displayName, ({ value }) =>
      value().trim() === '' ? requiredError() : undefined,
    );
  });
  protected readonly nameBlank = computed(
    () => this.#nameTried() && this.nameForm.displayName().invalid(),
  );

  readonly #roleTried = signal(false);
  readonly #role = signal({ roleId: '' });
  protected readonly roleForm = form(this.#role);
  protected readonly roleMissing = computed(() => this.#roleTried() && this.#role().roleId === '');

  protected openRename(): void {
    this.#name.set({ displayName: this.user().displayName });
    this.#nameTried.set(false);
    this.renaming.set(true);
  }

  protected closeRename(): void {
    this.renaming.set(false);
    this.#focus.to(`rename:${this.user().id}`);
  }

  protected async rename(event: Event): Promise<void> {
    event.preventDefault();
    this.#nameTried.set(true);
    if (this.nameForm.displayName().invalid()) return;
    const ok = await this.directory.update(this.user().id, {
      displayName: this.#name().displayName.trim(),
    });
    if (ok) this.closeRename();
  }

  protected async assign(event: Event): Promise<void> {
    event.preventDefault();
    this.#roleTried.set(true);
    const { roleId } = this.#role();
    if (roleId === '') return;
    if (await this.directory.assign(this.user().id, roleId)) {
      this.#role.set({ roleId: '' });
      this.#roleTried.set(false);
    }
  }
}
