import { Component, input, output, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import type { Language } from '../../../core/catalog/catalog.model';
import { ModalDialog } from '../../../shared/ui/modal-dialog';

let nextId = 0;

/**
 * Picks the language a project's base language is mixed with: the base is fixed, the other is
 * one of the project's other languages. The owner makes the call and closes it.
 */
@Component({
  selector: 'app-code-switching-dialog',
  imports: [TranslocoPipe, ModalDialog],
  template: `
    <app-dialog
      [title]="'admin.projectLanguages.codeSwitching.title' | transloco"
      [locked]="busy()"
      (dismissed)="dismissed.emit()"
    >
      <p class="muso-meta">{{ 'admin.projectLanguages.codeSwitching.lead' | transloco }}</p>
      <form novalidate class="code-switching-form" (submit)="confirm($event)">
        <div class="field">
          <span class="label" [id]="id + '-base'">
            {{ 'admin.projectLanguages.codeSwitching.base' | transloco }}
          </span>
          <p class="fixed-base" [attr.aria-labelledby]="id + '-base'">{{ base().name }}</p>
        </div>
        <div class="field">
          <label [for]="id + '-other'">
            {{ 'admin.projectLanguages.codeSwitching.other' | transloco }}
          </label>
          <select
            [id]="id + '-other'"
            [value]="choice()"
            [disabled]="busy()"
            [attr.aria-invalid]="missing() ? 'true' : null"
            [attr.aria-describedby]="missing() ? id + '-other-error' : null"
            (change)="choose($any($event.target).value)"
          >
            <option value="">
              {{ 'admin.projectLanguages.codeSwitching.choose' | transloco }}
            </option>
            @for (language of others(); track language.id) {
              <option [value]="language.id">{{ language.name }} ({{ language.code }})</option>
            }
          </select>
          @if (missing()) {
            <p class="field-error" [id]="id + '-other-error'">
              {{ 'admin.projectLanguages.codeSwitching.required' | transloco }}
            </p>
          }
        </div>
        @if (error(); as message) {
          <p class="field-error" role="alert">{{ message }}</p>
        }
        <div class="actions">
          <button type="button" class="secondary" [disabled]="busy()" (click)="dismissed.emit()">
            {{ 'admin.projectLanguages.codeSwitching.cancel' | transloco }}
          </button>
          <button type="submit" [disabled]="busy()">
            {{ 'admin.projectLanguages.codeSwitching.submit' | transloco }}
          </button>
        </div>
      </form>
    </app-dialog>
  `,
  styles: `
    .code-switching-form {
      display: grid;
      gap: var(--muso-space-3);
    }
    .field {
      display: grid;
      gap: var(--muso-space-1);
    }
    .label,
    label {
      font-weight: 600;
    }
    .fixed-base {
      margin: 0;
      padding: var(--muso-space-1) var(--muso-space-2);
      border: 1px solid var(--card-border);
      border-radius: var(--muso-radius);
      background: var(--muso-surface-sunken);
    }
    select {
      inline-size: 100%;
    }
    .field-error {
      margin: 0;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: var(--muso-space-1);
    }
  `,
})
export class CodeSwitchingDialog {
  readonly base = input.required<Language>();
  /** The project's languages the base may be mixed with. */
  readonly others = input.required<readonly Language[]>();
  readonly busy = input(false);
  readonly error = input<string | null>(null);

  /** The id of the language to mix with the base. */
  readonly confirmed = output<string>();
  readonly dismissed = output();

  protected readonly id = `code-switching-${nextId++}`;
  protected readonly choice = signal('');
  protected readonly missing = signal(false);

  protected choose(languageId: string): void {
    this.choice.set(languageId);
    if (languageId) this.missing.set(false);
  }

  protected confirm(event: Event): void {
    event.preventDefault();
    const languageId = this.choice();
    if (!languageId) {
      this.missing.set(true);
      return;
    }
    this.confirmed.emit(languageId);
  }
}
