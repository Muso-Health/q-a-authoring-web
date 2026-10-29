import { Component, computed, inject, input, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { FocusReturn, FocusReturnTarget } from '../../shared/ui/focus-return';
import { Typeahead } from '../../shared/ui/typeahead';
import { ConceptEditor } from './concept-editor';
import type { Tag } from './concept-view';

const LABELS = {
  intents: {
    heading: 'concept.intents',
    none: 'concept.noIntents',
    field: 'classification.intent',
    add: 'classification.addIntent',
    remove: 'classification.removeIntent',
  },
  categories: {
    heading: 'concept.categories',
    none: 'concept.noCategories',
    field: 'classification.category',
    add: 'classification.addCategory',
    remove: 'classification.removeCategory',
  },
} as const;

/**
 * The concept's intents or its categories: they hold for every language. With `author_qasets`,
 * attach one from the catalogue — or create it there first, with its own permission.
 */
@Component({
  selector: 'app-concept-tags',
  imports: [TranslocoPipe, Typeahead, FocusReturnTarget],
  template: `
    @let l = labels();
    <div class="tags" [attr.data-kind]="kind()">
      <h2 class="muso-eyebrow" [id]="kind() + '-heading'">{{ l.heading | transloco }}</h2>
      @if (tags().length > 0) {
        <ul class="muso-chips" [attr.aria-labelledby]="kind() + '-heading'">
          @for (tag of tags(); track tag.id) {
            <li>
              <span class="chip-label">{{ tag.label }}</span>
              @if (editor.canAuthor()) {
                <button
                  type="button"
                  class="chip-remove"
                  [disabled]="editor.busy()"
                  [attr.aria-label]="l.remove | transloco: { label: tag.label }"
                  (click)="remove(tag.id)"
                >
                  <span aria-hidden="true">×</span>
                </button>
              }
            </li>
          }
        </ul>
      } @else {
        <span class="muso-meta">{{ l.none | transloco }}</span>
      }
      @if (editor.canAuthor() && !adding()) {
        <button
          type="button"
          class="secondary small"
          [appFocusReturn]="'add-' + kind()"
          [disabled]="editor.busy()"
          (click)="adding.set(true)"
        >
          {{ l.add | transloco }}
        </button>
      }
    </div>
    @if (adding()) {
      <app-typeahead
        [label]="l.field | transloco"
        [search]="search()"
        [exclude]="ids()"
        [canCreate]="canCreate()"
        [error]="editor.errorFor(kind())"
        (picked)="attach($event.id)"
        (created)="create($event)"
        (cancel)="close()"
      />
    } @else if (editor.errorFor(kind()); as message) {
      <p class="field-error" role="alert">{{ message }}</p>
    }
  `,
  styles: `
    .tags {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--muso-space-2);
      margin-block-end: var(--muso-space-1);
    }
    h2 {
      margin: 0;
    }
  `,
})
export class ConceptTags {
  protected readonly editor = inject(ConceptEditor);
  readonly #focus = inject(FocusReturn);

  readonly kind = input.required<'intents' | 'categories'>();

  protected readonly labels = computed(() => LABELS[this.kind()]);
  protected readonly adding = signal(false);
  protected readonly tags = computed<readonly Tag[]>(() => this.editor.view()?.[this.kind()] ?? []);
  protected readonly ids = computed(() => this.tags().map((tag) => tag.id));
  protected readonly search = computed(() =>
    this.kind() === 'intents' ? this.editor.searchIntents : this.editor.searchCategories,
  );
  protected readonly canCreate = computed(() =>
    this.kind() === 'intents' ? this.editor.canCreateIntents() : this.editor.canCreateCategories(),
  );

  protected remove(id: string): void {
    void (this.kind() === 'intents'
      ? this.editor.detachIntent(id)
      : this.editor.removeCategory(id));
  }

  protected async attach(id: string): Promise<void> {
    const done =
      this.kind() === 'intents'
        ? await this.editor.attachIntent(id)
        : await this.editor.addCategory(id);
    if (done) this.close();
  }

  protected async create(text: string): Promise<void> {
    const done =
      this.kind() === 'intents'
        ? await this.editor.createIntent(text)
        : await this.editor.createCategory(text);
    if (done) this.close();
  }

  protected close(): void {
    this.adding.set(false);
    this.editor.clearError(this.kind());
    this.#focus.to(`add-${this.kind()}`);
  }
}
