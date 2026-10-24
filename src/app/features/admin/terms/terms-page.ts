import { Component, computed, inject, input, resource, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { TaxonomyAdminApi } from '../../../core/admin/taxonomy-admin-api';
import type { TaxonomyEntry } from '../../../core/catalog/taxonomy-api';
import { ConfirmAction } from '../../../shared/ui/confirm-action';
import { LoadError, Loading } from '../../../shared/ui/load-state';
import { AdminWrites, reread } from '../admin-writes';
import { TextForm, type TextSeed } from '../text-form';

export type TermKind = 'intents' | 'categories';

type Label =
  'title' | 'search' | 'create' | 'field' | 'deleteName' | 'deleteWarning' | 'empty' | 'noMatch';

interface Kind {
  /** i18n keys. */
  readonly labels: Readonly<Record<Label, string>>;
  readonly list: (api: TaxonomyAdminApi, query: string) => Promise<TaxonomyEntry[]>;
  readonly add: (api: TaxonomyAdminApi, label: string) => Promise<void>;
  readonly remove: (api: TaxonomyAdminApi, id: string) => Promise<void>;
}

const KINDS: Record<TermKind, Kind> = {
  intents: {
    labels: {
      title: 'admin.terms.intents.title',
      search: 'admin.terms.intents.search',
      create: 'admin.terms.intents.create',
      field: 'admin.terms.intents.field',
      deleteName: 'admin.terms.intents.deleteName',
      deleteWarning: 'admin.terms.intents.deleteWarning',
      empty: 'admin.terms.intents.empty',
      noMatch: 'admin.terms.intents.noMatch',
    },
    list: (api, query) => api.intents(query),
    add: (api, text) => api.createIntent(text),
    remove: (api, id) => api.deleteIntent(id),
  },
  categories: {
    labels: {
      title: 'admin.terms.categories.title',
      search: 'admin.terms.categories.search',
      create: 'admin.terms.categories.create',
      field: 'admin.terms.categories.field',
      deleteName: 'admin.terms.categories.deleteName',
      deleteWarning: 'admin.terms.categories.deleteWarning',
      empty: 'admin.terms.categories.empty',
      noMatch: 'admin.terms.categories.noMatch',
    },
    list: (api, query) => api.categories(query),
    add: (api, name) => api.createCategory(name),
    remove: (api, id) => api.deleteCategory(id),
  },
};

const CREATE = 'create';
const termTarget = (id: string) => `term:${id}`;

/**
 * A shared catalogue of intents or categories: searched by its beginning, added to, and pruned
 * of what nothing uses any more. There is no renaming: an entry is its text.
 */
@Component({
  selector: 'app-terms-page',
  imports: [TranslocoPipe, Loading, LoadError, TextForm, ConfirmAction],
  providers: [AdminWrites],
  template: `
    <h2>{{ labels().title | transloco }}</h2>

    <section class="muso-card" aria-labelledby="create-term-heading">
      <h3 id="create-term-heading">{{ labels().create | transloco }}</h3>
      <app-text-form
        [label]="labels().field"
        submitLabel="admin.terms.createSubmit"
        [initial]="createSeed()"
        [busy]="writes.busy()"
        [error]="writes.errorFor(createTarget)"
        (save)="create($event)"
      />
    </section>

    <div class="search" role="search">
      <label for="term-search">{{ labels().search | transloco }}</label>
      <input
        id="term-search"
        type="search"
        autocomplete="off"
        [value]="query()"
        (input)="query.set($any($event.target).value)"
      />
    </div>

    <div aria-live="polite">
      @if (writes.notice(); as notice) {
        <p class="page-notice muso-notice">{{ notice }}</p>
      }
    </div>

    @if (terms.hasValue()) {
      @if (terms.value().length > 0) {
        <ul class="muso-cards">
          @for (term of terms.value(); track term.id) {
            <li class="term muso-card">
              <h3>{{ term.label }}</h3>
              @if (writes.errorFor(target(term.id)); as message) {
                <p class="field-error" role="alert">{{ message }}</p>
              }
              <app-confirm-action
                [small]="true"
                [label]="'admin.catalog.delete' | transloco"
                [accessibleName]="labels().deleteName | transloco: { term: term.label }"
                [warning]="labels().deleteWarning | transloco: { term: term.label }"
                [busy]="writes.busy()"
                (confirmed)="remove(term.id)"
              />
            </li>
          }
        </ul>
      } @else {
        <p class="muso-empty">
          {{ (searched() ? labels().noMatch : labels().empty) | transloco }}
        </p>
      }
    } @else if (terms.error()) {
      <app-load-error [error]="terms.error()" (retry)="terms.reload()" />
    } @else {
      <app-loading />
    }
  `,
  styles: `
    h3 {
      margin-block: 0 var(--muso-space-1);
      font-size: var(--muso-body-lg-size);
    }
    .search {
      margin-block: var(--muso-space-3);
    }
    .search input {
      max-inline-size: 32rem;
    }
    .term {
      display: grid;
      gap: var(--muso-space-1);
      justify-items: start;
    }
    .term p {
      margin: 0;
    }
  `,
})
export class TermsPage {
  readonly #api = inject(TaxonomyAdminApi);
  protected readonly writes = inject(AdminWrites);
  protected readonly createTarget = CREATE;

  /** From the route's data. */
  readonly kind = input.required<TermKind>();
  readonly #kind = computed(() => KINDS[this.kind()]);
  protected readonly labels = computed(() => this.#kind().labels);

  protected readonly query = signal('');
  readonly #search = computed(() => this.query().trim());
  protected readonly searched = computed(() => this.#search() !== '');

  protected readonly terms = resource({
    params: () => ({ kind: this.#kind(), query: this.#search() }),
    loader: ({ params: { kind, query } }) => kind.list(this.#api, query),
  });

  protected readonly createSeed = signal<TextSeed>({ text: '' });

  protected target(id: string): string {
    return termTarget(id);
  }

  protected async create(label: string): Promise<void> {
    const kind = this.#kind();
    if (await this.#write(CREATE, () => kind.add(this.#api, label))) {
      this.createSeed.set({ text: '' });
    }
  }

  protected remove(id: string): void {
    const kind = this.#kind();
    void this.#write(termTarget(id), () => kind.remove(this.#api, id));
  }

  #write(target: string, call: () => Promise<void>): Promise<boolean> {
    const kind = this.#kind();
    const query = this.#search();
    return this.writes.run(target, call, () =>
      reread(this.terms, () => kind.list(this.#api, query)),
    );
  }
}
