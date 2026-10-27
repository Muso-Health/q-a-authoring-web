import { Component, computed, inject, input, signal } from '@angular/core';
import { FormField, form, requiredError, validate } from '@angular/forms/signals';
import { TranslocoPipe } from '@jsverse/transloco';
import type { AdminUser } from '../../../core/admin/access-api';
import { ConfirmAction } from '../../../shared/ui/confirm-action';
import { FocusReturn, FocusReturnTarget } from '../../../shared/ui/focus-return';
import { UserDirectory, userTarget } from './user-directory';

let nextId = 0;

/**
 * One user: rename, (de)activate — never delete — and hand out or take back roles, each within a
 * scope: a project and a language, either of which may be "any".
 */
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
    @if (it.assignments.length > 0) {
      <ul class="assignments">
        @for (assignment of it.assignments; track assignment.id) {
          @let project = assignment.project?.name ?? ('admin.users.anyProject' | transloco);
          @let language = assignment.language?.name ?? ('admin.users.anyLanguage' | transloco);
          <li class="assignment">
            <span class="role-name">{{ assignment.role.name }}</span>
            <span class="scope-project" [class.any]="assignment.project === null">{{
              'admin.users.scopeProject' | transloco: { name: project }
            }}</span>
            <span class="scope-language" [class.any]="assignment.language === null">{{
              'admin.users.scopeLanguage' | transloco: { name: language }
            }}</span>
            <button
              type="button"
              class="chip-remove"
              [disabled]="directory.writes.busy()"
              [attr.aria-label]="
                'admin.users.unassign'
                  | transloco
                    : {
                        role: assignment.role.name,
                        project: project,
                        language: language,
                        user: it.displayName,
                      }
              "
              (click)="directory.unassign(it.id, assignment.id)"
            >
              <span aria-hidden="true">×</span>
            </button>
          </li>
        }
      </ul>
    } @else {
      <p class="muso-meta">{{ 'admin.users.noRole' | transloco }}</p>
    }

    @if (roles().length > 0) {
      <form novalidate class="assign" (submit)="assign($event)">
        <div class="pickers">
          <div class="picker">
            <label [for]="id + '-role'">{{ 'admin.users.assign' | transloco }}</label>
            <select [id]="id + '-role'" [formField]="assignForm.roleId">
              <option value="">{{ 'admin.users.chooseRole' | transloco }}</option>
              @for (role of roles(); track role.id) {
                <option [value]="role.id">{{ role.name }}</option>
              }
            </select>
          </div>
          <!-- Both optional: the first choice, "any", is what a blank sends — null. -->
          <div class="picker">
            <label [for]="id + '-project'">{{ 'admin.users.project' | transloco }}</label>
            <select [id]="id + '-project'" [formField]="assignForm.projectId">
              <option value="">{{ 'admin.users.anyProject' | transloco }}</option>
              @for (project of projects(); track project.id) {
                <option [value]="project.id">{{ project.name }}</option>
              }
            </select>
          </div>
          <div class="picker">
            <label [for]="id + '-language'">{{ 'admin.users.language' | transloco }}</label>
            <select [id]="id + '-language'" [formField]="assignForm.languageId">
              <option value="">{{ 'admin.users.anyLanguage' | transloco }}</option>
              @for (language of languages(); track language.id) {
                <option [value]="language.id">{{ language.name }}</option>
              }
            </select>
          </div>
          <button type="submit" class="secondary" [disabled]="directory.writes.busy()">
            {{ 'admin.users.assignSubmit' | transloco }}
          </button>
        </div>
        @if (assignProblem(); as problem) {
          <p class="field-error">{{ problem | transloco: { user: it.displayName } }}</p>
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
    .assignments {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: var(--muso-space-1);
    }
    /* One row per assignment: the role, then the scope it holds in — "any" set quieter. */
    .assignment {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--muso-space-1) var(--muso-space-2);
      padding: var(--muso-space-1) var(--muso-space-2);
      border: 1px solid var(--card-border);
      border-radius: var(--muso-radius);
      background: var(--muso-surface);
    }
    .role-name {
      font-weight: 600;
    }
    .scope-project,
    .scope-language {
      font-size: var(--muso-caption-size);
    }
    .any {
      color: var(--muted-fg);
    }
    .assignment .chip-remove {
      margin-inline-start: auto;
    }
    .pickers {
      display: flex;
      flex-wrap: wrap;
      align-items: end;
      gap: var(--muso-space-1);
    }
    .picker {
      display: grid;
      gap: 0.25rem;
      flex: 1 1 10rem;
    }
    .picker select {
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
  protected readonly roles = computed(() =>
    this.directory.roles.hasValue() ? this.directory.roles.value() : [],
  );
  protected readonly projects = computed(() =>
    this.directory.projects.hasValue() ? this.directory.projects.value() : [],
  );
  protected readonly languages = computed(() =>
    this.directory.languages.hasValue() ? this.directory.languages.value() : [],
  );

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

  readonly #blankAssignment = { roleId: '', projectId: '', languageId: '' };
  readonly #assignTried = signal(false);
  readonly #duplicate = signal(false);
  readonly #assignment = signal({ ...this.#blankAssignment });
  protected readonly assignForm = form(this.#assignment);
  /** The i18n key of what stops this assignment, if anything: no role, or already held so. */
  protected readonly assignProblem = computed(() => {
    if (this.#assignTried() && this.#assignment().roleId === '') return 'admin.users.roleRequired';
    return this.#duplicate() ? 'admin.users.alreadyAssigned' : null;
  });

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
    this.#assignTried.set(true);
    this.#duplicate.set(false);
    const { roleId, projectId, languageId } = this.#assignment();
    if (roleId === '') return;
    // A blank picker is "any", which the engine reads as null.
    const draft = {
      roleId,
      projectId: projectId === '' ? null : projectId,
      languageId: languageId === '' ? null : languageId,
    };
    // Exactly this, already held: the engine would answer 200 and change nothing — say so instead.
    const held = this.user().assignments.some(
      (a) =>
        a.role.id === draft.roleId &&
        (a.project?.id ?? null) === draft.projectId &&
        (a.language?.id ?? null) === draft.languageId,
    );
    if (held) {
      this.#duplicate.set(true);
      return;
    }
    if (await this.directory.assign(this.user().id, draft)) {
      this.#assignment.set({ ...this.#blankAssignment });
      this.#assignTried.set(false);
    }
  }
}
