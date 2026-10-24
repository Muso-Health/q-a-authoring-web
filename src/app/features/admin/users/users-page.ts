import { Component, computed, inject, signal } from '@angular/core';
import { FormField, email, form, requiredError, validate } from '@angular/forms/signals';
import { TranslocoPipe } from '@jsverse/transloco';
import { LoadError, Loading } from '../../../shared/ui/load-state';
import { AdminWrites } from '../admin-writes';
import { UserCard } from './user-card';
import { CREATE_USER, UserDirectory } from './user-directory';

const blankIsRequired = ({ value }: { value: () => string }) =>
  value().trim() === '' ? requiredError() : undefined;

/** Who may use the platform: provision, rename, (de)activate and give roles. */
@Component({
  selector: 'app-users-page',
  imports: [FormField, TranslocoPipe, Loading, LoadError, UserCard],
  providers: [AdminWrites, UserDirectory],
  template: `
    <h2>{{ 'admin.users.title' | transloco }}</h2>

    <section class="muso-card" aria-labelledby="create-user-heading">
      <h3 id="create-user-heading">{{ 'admin.users.create' | transloco }}</h3>
      <form novalidate class="create" (submit)="create($event)">
        <label for="new-user-email">{{ 'admin.users.email' | transloco }}</label>
        <input
          id="new-user-email"
          type="email"
          autocomplete="off"
          [formField]="newUser.email"
          [attr.aria-invalid]="emailError() ? 'true' : null"
          [attr.aria-describedby]="emailError() ? 'new-user-email-error' : null"
        />
        @if (emailError(); as key) {
          <p class="field-error" id="new-user-email-error">{{ key | transloco }}</p>
        }
        <label for="new-user-name">{{ 'admin.users.displayName' | transloco }}</label>
        <input
          id="new-user-name"
          type="text"
          autocomplete="off"
          [formField]="newUser.displayName"
          [attr.aria-invalid]="nameBlank() ? 'true' : null"
          [attr.aria-describedby]="nameBlank() ? 'new-user-name-error' : null"
        />
        @if (nameBlank()) {
          <p class="field-error" id="new-user-name-error">{{ 'admin.required' | transloco }}</p>
        }
        @if (directory.writes.errorFor(createTarget); as message) {
          <p class="field-error" role="alert">{{ message }}</p>
        }
        <div class="actions">
          <button type="submit" [disabled]="directory.writes.busy()">
            {{ 'admin.users.createSubmit' | transloco }}
          </button>
        </div>
      </form>
    </section>

    <div aria-live="polite">
      @if (directory.writes.notice(); as notice) {
        <p class="page-notice muso-notice">{{ notice }}</p>
      }
    </div>

    @if (directory.users.hasValue()) {
      @if (directory.users.value().length > 0) {
        <ul class="muso-cards">
          @for (user of directory.users.value(); track user.id) {
            <li class="user muso-card"><app-user-card [user]="user" /></li>
          }
        </ul>
      } @else {
        <p class="muso-empty">{{ 'admin.users.empty' | transloco }}</p>
      }
    } @else if (directory.users.error()) {
      <app-load-error [error]="directory.users.error()" (retry)="directory.users.reload()" />
    } @else {
      <app-loading />
    }
  `,
  styles: `
    h3 {
      margin-block: 0 var(--muso-space-1);
      font-size: var(--muso-body-lg-size);
    }
    input {
      max-inline-size: 32rem;
    }
  `,
})
export class UsersPage {
  protected readonly directory = inject(UserDirectory);
  protected readonly createTarget = CREATE_USER;

  readonly #model = signal({ email: '', displayName: '' });
  protected readonly newUser = form(this.#model, (path) => {
    validate(path.email, blankIsRequired);
    email(path.email);
    validate(path.displayName, blankIsRequired);
  });
  readonly #tried = signal(false);

  /** The i18n key of what is wrong with the email, once a submit has been tried. */
  protected readonly emailError = computed(() => {
    if (!this.#tried()) return null;
    const kinds = this.newUser
      .email()
      .errors()
      .map((error) => error.kind);
    if (kinds.includes('required')) return 'admin.required';
    return kinds.includes('email') ? 'admin.users.invalidEmail' : null;
  });
  protected readonly nameBlank = computed(
    () => this.#tried() && this.newUser.displayName().invalid(),
  );

  protected async create(event: Event): Promise<void> {
    event.preventDefault();
    this.#tried.set(true);
    if (this.newUser().invalid()) return;
    const { email, displayName } = this.#model();
    if (await this.directory.create(email.trim(), displayName.trim())) {
      this.#model.set({ email: '', displayName: '' });
      this.#tried.set(false);
    }
  }
}
