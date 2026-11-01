import { Component, computed, inject, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { DialogHost, ModalDialog } from '../../shared/ui/modal-dialog';
import { Typeahead } from '../../shared/ui/typeahead';
import { ConceptEditor } from './concept-editor';
import type { Tag } from './concept-view';

export type TagKind = 'intents' | 'categories';

const LABELS = {
  intents: {
    heading: 'concept.intents',
    none: 'concept.noIntents',
    field: 'classification.intent',
    add: 'classification.addIntent',
    removeTool: 'tools.removeIntent',
    remove: 'classification.removeIntent',
  },
  categories: {
    heading: 'concept.categories',
    none: 'concept.noCategories',
    field: 'classification.category',
    add: 'classification.addCategory',
    removeTool: 'tools.removeCategory',
    remove: 'classification.removeCategory',
  },
} as const;

function tagsOf(editor: ConceptEditor, kind: () => TagKind) {
  return computed<readonly Tag[]>(() => editor.view()?.[kind()] ?? []);
}

/**
 * The concept's intents or its categories, as chips: they hold for every language. Adding and
 * removing them is the notion toolbar's job.
 */
@Component({
  selector: 'app-concept-tags',
  imports: [TranslocoPipe],
  template: `
    @let l = labels();
    <div class="tags" [attr.data-kind]="kind()">
      <h2 class="muso-eyebrow" [id]="kind() + '-heading'">{{ l.heading | transloco }}</h2>
      @if (tags().length > 0) {
        <ul class="muso-chips" [attr.aria-labelledby]="kind() + '-heading'">
          @for (tag of tags(); track tag.id) {
            <li>
              <span class="chip-label">{{ tag.label }}</span>
            </li>
          }
        </ul>
      } @else {
        <span class="muso-meta">{{ l.none | transloco }}</span>
      }
    </div>
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
  readonly kind = input.required<TagKind>();
  protected readonly labels = computed(() => LABELS[this.kind()]);
  protected readonly tags = tagsOf(inject(ConceptEditor), this.kind);
}

/**
 * A modal that attaches an intent or a category to the concept — picked from the catalogue, or
 * created there first with its own permission — or detaches those it has.
 */
@Component({
  selector: 'app-concept-tag-dialog',
  hostDirectives: [DialogHost],
  imports: [TranslocoPipe, ModalDialog, Typeahead],
  template: `
    @let l = labels();
    <app-dialog
      [title]="(mode() === 'add' ? l.add : l.removeTool) | transloco"
      [locked]="editor.busy()"
      (dismissed)="close()"
    >
      @if (mode() === 'add') {
        <app-typeahead
          [label]="l.field | transloco"
          [search]="search()"
          [exclude]="ids()"
          [canCreate]="canCreate()"
          [listAll]="true"
          [error]="editor.errorFor(kind())"
          (picked)="attach($event.id)"
          (created)="create($event)"
          (cancel)="close()"
        />
      } @else {
        @if (tags().length === 0) {
          <p class="muso-meta">{{ l.none | transloco }}</p>
        } @else {
          <ul class="removable">
            @for (tag of tags(); track tag.id) {
              <li>
                <span>{{ tag.label }}</span>
                <button
                  type="button"
                  class="secondary small"
                  [disabled]="editor.busy()"
                  [attr.aria-label]="l.remove | transloco: { label: tag.label }"
                  (click)="detach(tag.id)"
                >
                  {{ 'authoring.remove' | transloco }}
                </button>
              </li>
            }
          </ul>
        }
        @if (editor.errorFor(kind()); as message) {
          <p class="field-error" role="alert">{{ message }}</p>
        }
      }
    </app-dialog>
  `,
  styles: `
    .removable {
      display: grid;
      gap: var(--muso-space-1);
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .removable li {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: var(--muso-space-2);
      padding-block: var(--muso-space-1);
      border-block-end: 1px solid var(--muso-border);
    }
  `,
})
export class ConceptTagDialog {
  protected readonly editor = inject(ConceptEditor);

  readonly kind = input.required<TagKind>();
  readonly mode = input.required<'add' | 'remove'>();
  readonly closed = output();

  protected readonly labels = computed(() => LABELS[this.kind()]);
  protected readonly tags = tagsOf(this.editor, this.kind);
  protected readonly ids = computed(() => this.tags().map((tag) => tag.id));
  protected readonly search = computed(() =>
    this.kind() === 'intents' ? this.editor.searchIntents : this.editor.searchCategories,
  );
  protected readonly canCreate = computed(() =>
    this.kind() === 'intents' ? this.editor.canCreateIntents() : this.editor.canCreateCategories(),
  );

  /** Detaching keeps the modal open, so several can go in a row. */
  protected detach(id: string): void {
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
    this.editor.clearError(this.kind());
    this.closed.emit();
  }
}
