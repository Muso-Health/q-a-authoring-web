import { Component, computed, inject, input, resource, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { CatalogAdminApi, type NamedDraft } from '../../../core/admin/catalog-admin-api';
import { CatalogApi } from '../../../core/catalog/catalog-api';
import type { Language } from '../../../core/catalog/catalog.model';
import type { Crumb } from '../../../core/catalog/trail';
import { Breadcrumb } from '../../../shared/ui/breadcrumb';
import { ConfirmAction } from '../../../shared/ui/confirm-action';
import { FocusReturn, FocusReturnTarget } from '../../../shared/ui/focus-return';
import { LoadError, Loading } from '../../../shared/ui/load-state';
import { AdminWrites, reread } from '../admin-writes';
import { NamedForm, type NamedSave } from './named-form';

type Level = 'projects' | 'protocols' | 'themes';

interface Entry extends NamedDraft {
  readonly id: string;
  readonly baseLanguage?: Language;
}

/** One level of the hierarchy: where it sits, and what it holds. */
interface View {
  readonly trail: readonly Crumb[];
  /** The parent's name; none for the projects. */
  readonly current: string | null;
  readonly entries: readonly Entry[];
  /** The base languages a new project may take. */
  readonly languages: readonly Language[];
}

interface Params {
  readonly projectId?: string;
  readonly protocolId?: string;
}

const CATALOG_ROOT = ['/admin', 'catalog'] as const;

const LABELS = {
  projects: {
    title: 'admin.catalog.projects.title',
    create: 'admin.catalog.projects.create',
    createSubmit: 'admin.catalog.projects.createSubmit',
    editName: 'admin.catalog.projects.editName',
    deleteName: 'admin.catalog.projects.deleteName',
    deleteWarning: 'admin.catalog.projects.deleteWarning',
    empty: 'admin.catalog.projects.empty',
  },
  protocols: {
    title: 'admin.catalog.protocols.title',
    create: 'admin.catalog.protocols.create',
    createSubmit: 'admin.catalog.protocols.createSubmit',
    editName: 'admin.catalog.protocols.editName',
    deleteName: 'admin.catalog.protocols.deleteName',
    deleteWarning: 'admin.catalog.protocols.deleteWarning',
    empty: 'admin.catalog.protocols.empty',
  },
  themes: {
    title: 'admin.catalog.themes.title',
    create: 'admin.catalog.themes.create',
    createSubmit: 'admin.catalog.themes.createSubmit',
    editName: 'admin.catalog.themes.editName',
    deleteName: 'admin.catalog.themes.deleteName',
    deleteWarning: 'admin.catalog.themes.deleteWarning',
    empty: 'admin.catalog.themes.empty',
  },
} as const satisfies Record<Level, Record<string, string>>;

const CREATE = 'create';
const entryTarget = (id: string) => `entry:${id}`;
const EMPTY: NamedDraft = { name: '', description: null };

const levelOf = ({ projectId, protocolId }: Params): Level =>
  protocolId ? 'themes' : projectId ? 'protocols' : 'projects';

/**
 * The catalogue's administration, one level at a time: the projects, a project's protocols, a
 * protocol's themes. Each level creates, edits and deletes its own entries and leads to the next.
 */
@Component({
  selector: 'app-catalog-page',
  imports: [
    RouterLink,
    TranslocoPipe,
    Breadcrumb,
    Loading,
    LoadError,
    NamedForm,
    ConfirmAction,
    FocusReturnTarget,
  ],
  providers: [AdminWrites],
  template: `
    @if (page.hasValue()) {
      @let view = page.value();
      @if (view.current !== null) {
        <app-breadcrumb
          rootLabel="admin.catalog.title"
          [rootLink]="catalogRoot"
          [trail]="view.trail"
          [current]="view.current"
        />
      }
      <h2>{{ labels().title | transloco }}</h2>

      <section class="muso-card" aria-labelledby="create-entry-heading">
        <h3 id="create-entry-heading">{{ labels().create | transloco }}</h3>
        <app-named-form
          mode="create"
          [initial]="createSeed()"
          [submitLabel]="labels().createSubmit"
          [languages]="level() === 'projects' ? view.languages : null"
          [busy]="writes.busy()"
          [error]="writes.errorFor(createTarget)"
          (save)="create($event)"
        />
      </section>

      <div aria-live="polite">
        @if (writes.notice(); as notice) {
          <p class="page-notice muso-notice">{{ notice }}</p>
        }
      </div>

      @if (view.entries.length > 0) {
        <ul class="muso-cards">
          @for (entry of view.entries; track entry.id) {
            <li class="entry muso-card">
              <h3>
                @if (childLink(entry.id); as link) {
                  <a [routerLink]="link">{{ entry.name }}</a>
                } @else {
                  {{ entry.name }}
                }
              </h3>
              @if (editing() === entry.id) {
                <app-named-form
                  mode="edit"
                  [initial]="entry"
                  [hint]="
                    entry.baseLanguage ? ('admin.catalog.baseLanguageFixed' | transloco) : null
                  "
                  [busy]="writes.busy()"
                  [error]="writes.errorFor(target(entry.id))"
                  (save)="update(entry.id, $event)"
                  (cancel)="closeEdit(entry.id)"
                />
              } @else {
                @if (entry.description) {
                  <p>{{ entry.description }}</p>
                }
                @if (entry.baseLanguage; as language) {
                  <p class="muso-meta">
                    {{ 'browse.baseLanguage' | transloco }} : {{ language.name }} ({{
                      language.code
                    }})
                  </p>
                }
                @if (writes.errorFor(target(entry.id)); as message) {
                  <p class="field-error" role="alert">{{ message }}</p>
                }
                <div class="actions">
                  <button
                    type="button"
                    class="secondary small"
                    [appFocusReturn]="'edit-entry:' + entry.id"
                    [disabled]="writes.busy()"
                    [attr.aria-label]="labels().editName | transloco: { name: entry.name }"
                    (click)="openEdit(entry.id)"
                  >
                    {{ 'admin.catalog.edit' | transloco }}
                  </button>
                  <app-confirm-action
                    [small]="true"
                    [label]="'admin.catalog.delete' | transloco"
                    [accessibleName]="labels().deleteName | transloco: { name: entry.name }"
                    [warning]="labels().deleteWarning | transloco: { name: entry.name }"
                    [busy]="writes.busy()"
                    (confirmed)="remove(entry.id)"
                  />
                </div>
              }
            </li>
          }
        </ul>
      } @else {
        <p class="muso-empty">{{ labels().empty | transloco }}</p>
      }
    } @else if (page.error()) {
      <app-load-error [error]="page.error()" (retry)="page.reload()" />
    } @else {
      <app-loading />
    }
  `,
  styles: `
    h3 {
      margin-block: 0 var(--muso-space-1);
      font-size: var(--muso-body-lg-size);
    }
    .entry {
      display: grid;
      gap: var(--muso-space-1);
    }
    .entry p {
      margin: 0;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: var(--muso-space-1);
    }
  `,
})
export class CatalogPage {
  readonly #catalog = inject(CatalogApi);
  readonly #admin = inject(CatalogAdminApi);
  readonly #focus = inject(FocusReturn);
  protected readonly writes = inject(AdminWrites);
  protected readonly createTarget = CREATE;
  protected readonly catalogRoot = CATALOG_ROOT;

  /** From the route: a project opens its protocols, a protocol its themes, neither the projects. */
  readonly projectId = input<string>();
  readonly protocolId = input<string>();

  readonly #params = computed<Params>(() => ({
    projectId: this.projectId(),
    protocolId: this.protocolId(),
  }));
  protected readonly level = computed(() => levelOf(this.#params()));
  protected readonly labels = computed(() => LABELS[this.level()]);

  protected readonly page = resource({
    params: () => this.#params(),
    loader: ({ params }) => this.#load(params),
  });

  protected readonly createSeed = signal<NamedDraft>(EMPTY);
  protected readonly editing = signal<string | null>(null);

  protected target(id: string): string {
    return entryTarget(id);
  }

  protected childLink(id: string): readonly string[] | null {
    switch (this.level()) {
      case 'projects':
        return [...CATALOG_ROOT, 'projects', id];
      case 'protocols':
        return [...CATALOG_ROOT, 'protocols', id];
      case 'themes':
        return null;
    }
  }

  protected async create({ draft, baseLanguageId }: NamedSave): Promise<void> {
    const { projectId, protocolId } = this.#params();
    const call = {
      projects: () => this.#admin.createProject(draft, baseLanguageId!),
      protocols: () => this.#admin.createProtocol(projectId!, draft),
      themes: () => this.#admin.createTheme(protocolId!, draft),
    }[this.level()];
    if (await this.#write(CREATE, call)) this.createSeed.set({ ...EMPTY });
  }

  protected async update(id: string, { draft }: NamedSave): Promise<void> {
    const call = {
      projects: () => this.#admin.updateProject(id, draft),
      protocols: () => this.#admin.updateProtocol(id, draft),
      themes: () => this.#admin.updateTheme(id, draft),
    }[this.level()];
    if (await this.#write(entryTarget(id), call)) this.closeEdit(id);
  }

  protected remove(id: string): void {
    const call = {
      projects: () => this.#admin.deleteProject(id),
      protocols: () => this.#admin.deleteProtocol(id),
      themes: () => this.#admin.deleteTheme(id),
    }[this.level()];
    void this.#write(entryTarget(id), call);
  }

  protected openEdit(id: string): void {
    this.writes.clearError(entryTarget(id));
    this.editing.set(id);
  }

  protected closeEdit(id: string): void {
    this.editing.set(null);
    this.writes.clearError(entryTarget(id));
    this.#focus.to(`edit-entry:${id}`);
  }

  #write(target: string, call: () => Promise<void>): Promise<boolean> {
    const params = this.#params();
    return this.writes.run(target, call, () => reread(this.page, () => this.#load(params)));
  }

  async #load(params: Params): Promise<View> {
    const named = ({ id, name, description }: Entry): Entry => ({ id, name, description });
    switch (levelOf(params)) {
      case 'projects': {
        const [projects, languages] = await Promise.all([
          this.#catalog.projects(),
          this.#catalog.languages(),
        ]);
        return {
          trail: [],
          current: null,
          entries: projects.map((p) => ({
            ...named(p),
            baseLanguage: languages.of(p.baseLanguageId),
          })),
          languages: languages.all(),
        };
      }
      case 'protocols': {
        const [project, protocols] = await Promise.all([
          this.#catalog.project(params.projectId!),
          this.#catalog.protocols(params.projectId!),
        ]);
        return { trail: [], current: project.name, entries: protocols.map(named), languages: [] };
      }
      case 'themes': {
        const [{ project, protocol }, themes] = await Promise.all([
          this.#catalog.lineageOfProtocol(params.protocolId!),
          this.#catalog.themes(params.protocolId!),
        ]);
        return {
          trail: [{ label: project.name, link: [...CATALOG_ROOT, 'projects', project.id] }],
          current: protocol.name,
          entries: themes.map(named),
          languages: [],
        };
      }
    }
  }
}
