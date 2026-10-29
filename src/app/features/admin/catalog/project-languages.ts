import { Component, computed, inject, input, resource, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { CatalogAdminApi } from '../../../core/admin/catalog-admin-api';
import { CatalogApi } from '../../../core/catalog/catalog-api';
import { ConfirmAction } from '../../../shared/ui/confirm-action';
import { LoadError, Loading } from '../../../shared/ui/load-state';
import { AdminWrites, reread } from '../admin-writes';

const ADD = 'add';
const languageTarget = (id: string) => `project-language:${id}`;

let nextId = 0;

/**
 * The languages a project's content may use: its base language first, fixed; others added from
 * the catalogue, and removed while nothing in the project uses them.
 */
@Component({
  selector: 'app-project-languages',
  imports: [TranslocoPipe, ConfirmAction, Loading, LoadError],
  providers: [AdminWrites],
  template: `
    <section class="muso-card" [attr.aria-labelledby]="id + '-heading'">
      <h3 [id]="id + '-heading'">{{ 'admin.projectLanguages.title' | transloco }}</h3>
      <p class="muso-meta">{{ 'admin.projectLanguages.lead' | transloco }}</p>
      @if (writes.notice(); as notice) {
        <p class="page-notice muso-notice" aria-live="polite">{{ notice }}</p>
      }
      @if (page.hasValue()) {
        <ul class="languages">
          @for (language of page.value().languages; track language.id) {
            <li class="project-language">
              <span class="name">{{ language.name }}</span>
              <code class="code">{{ language.code }}</code>
              @if (language.isBase) {
                <span class="base">{{ 'admin.projectLanguages.base' | transloco }}</span>
              } @else {
                <app-confirm-action
                  [small]="true"
                  [label]="'admin.projectLanguages.remove' | transloco"
                  [accessibleName]="
                    'admin.projectLanguages.removeName' | transloco: { language: language.name }
                  "
                  [warning]="
                    'admin.projectLanguages.removeWarning' | transloco: { language: language.name }
                  "
                  [busy]="writes.busy()"
                  (confirmed)="remove(language.id)"
                />
              }
              @if (writes.errorFor(target(language.id)); as message) {
                <p class="field-error" role="alert">{{ message }}</p>
              }
            </li>
          }
        </ul>
        @if (addable().length === 0) {
          <p class="none muso-meta">{{ 'admin.projectLanguages.none' | transloco }}</p>
        } @else {
          <form novalidate class="add" (submit)="add($event)">
            <label [for]="id + '-add'">{{ 'admin.projectLanguages.add' | transloco }}</label>
            <select
              [id]="id + '-add'"
              [value]="choice()"
              [attr.aria-invalid]="missing() ? 'true' : null"
              [attr.aria-describedby]="missing() ? id + '-add-error' : null"
              (change)="choose($any($event.target).value)"
            >
              <option value="">{{ 'admin.projectLanguages.choose' | transloco }}</option>
              @for (language of addable(); track language.id) {
                <option [value]="language.id">{{ language.name }} ({{ language.code }})</option>
              }
            </select>
            @if (missing()) {
              <p class="field-error" [id]="id + '-add-error'">
                {{ 'admin.projectLanguages.required' | transloco }}
              </p>
            }
            @if (writes.errorFor(addTarget); as message) {
              <p class="field-error" role="alert">{{ message }}</p>
            }
            <div class="actions">
              <button type="submit" [disabled]="writes.busy()">
                {{ 'admin.projectLanguages.addSubmit' | transloco }}
              </button>
            </div>
          </form>
        }
      } @else if (page.error()) {
        <app-load-error [error]="page.error()" (retry)="page.reload()" />
      } @else {
        <app-loading />
      }
    </section>
  `,
  styles: `
    :host {
      display: block;
      margin-block-end: var(--muso-space-3);
    }
    h3 {
      margin-block: 0 var(--muso-space-1);
      font-size: var(--muso-body-lg-size);
    }
    .languages {
      display: grid;
      gap: var(--muso-space-1);
      margin: var(--muso-space-2) 0;
      padding: 0;
      list-style: none;
    }
    .project-language {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--muso-space-1) var(--muso-space-2);
      padding-block: var(--muso-space-1);
      border-block-end: 1px solid var(--card-border);
    }
    .name {
      font-weight: 600;
    }
    .code {
      color: var(--muted-fg);
    }
    .base {
      padding: 0.1rem var(--muso-space-1);
      border-radius: var(--muso-radius);
      background: var(--muso-navy);
      color: var(--muso-text-inverse);
      font-size: var(--muso-caption-size);
      font-weight: 600;
    }
    .project-language .field-error {
      flex-basis: 100%;
      margin: 0;
    }
    select {
      max-inline-size: 32rem;
    }
    .actions {
      display: flex;
      gap: var(--muso-space-1);
    }
  `,
})
export class ProjectLanguages {
  readonly #catalog = inject(CatalogApi);
  readonly #admin = inject(CatalogAdminApi);
  protected readonly writes = inject(AdminWrites);
  protected readonly id = `project-languages-${nextId++}`;
  protected readonly addTarget = ADD;

  readonly projectId = input.required<string>();

  protected readonly page = resource({
    params: () => this.projectId(),
    loader: ({ params }) => this.#load(params),
  });

  /** Catalogue languages the project does not have yet. */
  protected readonly addable = computed(() => {
    if (!this.page.hasValue()) return [];
    const { languages, catalogue } = this.page.value();
    const present = new Set(languages.map((language) => language.id));
    return catalogue.filter((language) => !present.has(language.id));
  });

  protected readonly choice = signal('');
  protected readonly missing = signal(false);

  protected target(id: string): string {
    return languageTarget(id);
  }

  protected choose(languageId: string): void {
    this.choice.set(languageId);
    if (languageId) this.missing.set(false);
  }

  protected async add(event: Event): Promise<void> {
    event.preventDefault();
    const languageId = this.choice();
    if (!languageId) {
      this.missing.set(true);
      return;
    }
    const projectId = this.projectId();
    if (await this.#write(ADD, () => this.#admin.addProjectLanguage(projectId, languageId))) {
      this.choice.set('');
    }
  }

  protected remove(languageId: string): void {
    const projectId = this.projectId();
    void this.#write(languageTarget(languageId), () =>
      this.#admin.removeProjectLanguage(projectId, languageId),
    );
  }

  #write(target: string, call: () => Promise<void>): Promise<boolean> {
    const projectId = this.projectId();
    return this.writes.run(target, call, () => reread(this.page, () => this.#load(projectId)));
  }

  async #load(projectId: string) {
    const [languages, catalogue] = await Promise.all([
      this.#catalog.projectLanguages(projectId),
      this.#catalog.languages(),
    ]);
    return { languages, catalogue: catalogue.all() };
  }
}
