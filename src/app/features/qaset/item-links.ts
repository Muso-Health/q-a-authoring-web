import { Component, computed, inject, input, signal } from '@angular/core';
import { FormField, form, requiredError, validate } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { QASetEditor } from './qaset-editor';
import type { ItemRole, ItemView } from './qaset-view';

let nextId = 0;

/**
 * An item's place in the translation graph: its counterparts, and — with `author_qasets` — the
 * hand-made links to add or remove. Candidates come from the loaded QASet, never a search.
 */
@Component({
  selector: 'app-item-links',
  imports: [FormField, RouterLink, TranslocoPipe],
  template: `
    @let it = item();
    @if (it.links.length > 0) {
      <div class="links">
        <span class="muso-meta">{{ 'qaset.translatedAs' | transloco }}</span>
        <ul>
          @for (link of it.links; track link.linkId) {
            <li>
              <a [routerLink]="[]" [fragment]="'item-' + link.otherId">{{ link.language.name }}</a>
              @if (editor.canAuthor()) {
                <button
                  type="button"
                  class="chip-remove"
                  [disabled]="editor.busy()"
                  [attr.aria-label]="
                    'links.unlinkName' | transloco: { language: link.language.name }
                  "
                  (click)="editor.unlink(role(), it.id, link.linkId)"
                >
                  <span aria-hidden="true">×</span>
                </button>
              }
            </li>
          }
        </ul>
      </div>
    }
    @if (editor.canAuthor()) {
      @if (linking()) {
        <div class="link-form">
          <form novalidate (submit)="submit($event)">
            <label [for]="id">{{ 'links.counterpart' | transloco }}</label>
            <select
              [id]="id"
              [formField]="field.counterpartId"
              [attr.aria-invalid]="tried() && field.counterpartId().invalid() ? 'true' : null"
            >
              <option value="">{{ 'links.choose' | transloco }}</option>
              @for (candidate of candidates(); track candidate.id) {
                <option [value]="candidate.id">
                  {{ candidate.language.name }} — {{ candidate.text }}
                </option>
              }
            </select>
            @if (tried() && field.counterpartId().invalid()) {
              <p class="field-error">{{ 'links.required' | transloco }}</p>
            }
            @if (editor.errorFor(target()); as message) {
              <p class="field-error" role="alert">{{ message }}</p>
            }
            <div class="actions">
              <button type="submit" [disabled]="editor.busy()">
                {{ 'links.submit' | transloco }}
              </button>
              <button type="button" class="secondary" (click)="close()">
                {{ 'authoring.cancel' | transloco }}
              </button>
            </div>
          </form>
        </div>
      } @else {
        @if (candidates().length > 0) {
          <button
            type="button"
            class="secondary small"
            [disabled]="editor.busy()"
            (click)="linking.set(true)"
          >
            {{ 'links.open' | transloco }}
          </button>
        }
        @if (editor.errorFor(target()); as message) {
          <p class="field-error" role="alert">{{ message }}</p>
        }
      }
    }
  `,
  styles: `
    :host {
      display: contents;
    }
    .links,
    ul,
    li {
      display: inline-flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--muso-space-1);
    }
    ul {
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .link-form {
      flex-basis: 100%;
    }
  `,
})
export class ItemLinks {
  protected readonly editor = inject(QASetEditor);
  protected readonly id = `item-links-${nextId++}`;

  readonly item = input.required<ItemView>();
  readonly role = input.required<ItemRole>();

  protected readonly target = computed(() => `links:${this.item().id}`);
  protected readonly candidates = computed(() =>
    this.editor.linkCandidates(this.role(), this.item().id),
  );
  protected readonly linking = signal(false);
  protected readonly tried = signal(false);

  readonly #model = signal({ counterpartId: '' });
  protected readonly field = form(this.#model, (path) => {
    validate(path.counterpartId, ({ value }) => (value() === '' ? requiredError() : undefined));
  });

  protected async submit(event: Event): Promise<void> {
    event.preventDefault();
    this.tried.set(true);
    if (this.field().invalid()) return;
    const linked = await this.editor.link(this.role(), this.item().id, this.#model().counterpartId);
    if (linked) this.close();
  }

  protected close(): void {
    this.linking.set(false);
    this.tried.set(false);
    this.#model.set({ counterpartId: '' });
    this.editor.clearError(this.target());
  }
}
