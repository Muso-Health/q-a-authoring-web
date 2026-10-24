import { Component, computed, effect, input, output, signal } from '@angular/core';
import { FormField, form, requiredError, validate } from '@angular/forms/signals';
import { TranslocoPipe } from '@jsverse/transloco';

export interface RoleDraft {
  readonly name: string;
  readonly permissions: readonly string[];
}

let nextId = 0;

/** A role's name and permissions, picked from the engine's catalogue. Shared by create and edit. */
@Component({
  selector: 'app-role-form',
  imports: [FormField, TranslocoPipe],
  template: `
    <form novalidate [class.create]="mode() === 'create'" (submit)="submit($event)">
      <label [for]="id + '-name'">{{ 'admin.roles.name' | transloco }}</label>
      <input
        type="text"
        autocomplete="off"
        [id]="id + '-name'"
        [formField]="field.name"
        [attr.aria-invalid]="blank() ? 'true' : null"
        [attr.aria-describedby]="blank() ? id + '-blank' : null"
      />
      @if (blank()) {
        <p class="field-error" [id]="id + '-blank'">{{ 'admin.required' | transloco }}</p>
      }
      <fieldset>
        <legend>{{ 'admin.roles.permissions' | transloco }}</legend>
        @for (code of catalogue(); track code) {
          <label class="choice">
            <input
              type="checkbox"
              [value]="code"
              [checked]="selected().has(code)"
              (change)="toggle(code)"
            />
            {{ labelOf()(code) }}
          </label>
        } @empty {
          <p class="muso-meta">{{ 'admin.roles.noCatalogue' | transloco }}</p>
        }
      </fieldset>
      @if (error(); as message) {
        <p class="field-error" role="alert">{{ message }}</p>
      }
      <div class="actions">
        <button type="submit" [disabled]="busy()">
          {{ (mode() === 'create' ? 'admin.roles.createSubmit' : 'authoring.save') | transloco }}
        </button>
        @if (mode() === 'edit') {
          <button type="button" class="secondary" (click)="cancel.emit()">
            {{ 'authoring.cancel' | transloco }}
          </button>
        }
      </div>
    </form>
  `,
  styles: `
    input[type='text'] {
      max-inline-size: 32rem;
    }
    fieldset {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
      gap: var(--muso-space-1) var(--muso-space-2);
      margin: var(--muso-space-1) 0 0;
      padding: var(--muso-space-2);
      border: 1px solid var(--card-border);
      border-radius: var(--muso-radius);
    }
    legend {
      padding-inline: var(--muso-space-1);
      font-weight: 600;
    }
    .choice {
      display: flex;
      align-items: center;
      gap: var(--muso-space-1);
      font-weight: 400;
    }
  `,
})
export class RoleForm {
  protected readonly id = `role-form-${nextId++}`;

  readonly mode = input<'create' | 'edit'>('create');
  /** A new object resets the form — after a create, or when editing another role. */
  readonly initial = input<RoleDraft>({ name: '', permissions: [] });
  readonly catalogue = input.required<readonly string[]>();
  readonly labelOf = input.required<(code: string) => string>();
  readonly busy = input(false);
  /** The engine's refusal, already translated. */
  readonly error = input<string | null>(null);
  readonly save = output<RoleDraft>();
  readonly cancel = output();

  readonly #model = signal({ name: '' });
  protected readonly field = form(this.#model, (path) => {
    validate(path.name, ({ value }) => (value().trim() === '' ? requiredError() : undefined));
  });
  protected readonly selected = signal<ReadonlySet<string>>(new Set());
  readonly #tried = signal(false);
  protected readonly blank = computed(() => this.#tried() && this.field.name().invalid());

  constructor() {
    effect(() => {
      const { name, permissions } = this.initial();
      this.#model.set({ name });
      this.selected.set(new Set(permissions));
      this.#tried.set(false);
    });
  }

  protected toggle(code: string): void {
    this.selected.update((codes) => {
      const next = new Set(codes);
      if (!next.delete(code)) next.add(code);
      return next;
    });
  }

  protected submit(event: Event): void {
    event.preventDefault();
    this.#tried.set(true);
    if (this.field.name().invalid()) return;
    const chosen = this.selected();
    // In catalogue order, then anything held that the catalogue no longer lists, so it is kept.
    const ordered = this.catalogue().filter((code) => chosen.has(code));
    const rest = [...chosen].filter((code) => !this.catalogue().includes(code));
    this.save.emit({ name: this.#model().name.trim(), permissions: [...ordered, ...rest] });
  }
}
