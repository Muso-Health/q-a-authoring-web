import {
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  resource,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { FormField, form } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { CatalogApi } from '../../core/catalog/catalog-api';
import type { Decision, QueueState } from '../../core/validation/validation-api';
import { LoadError, Loading } from '../../shared/ui/load-state';
import { ValidationBadge } from '../../shared/ui/validation-badge';
import { AudioCard, ClinicalCard, TranslationCard } from './item-cards';
import type { QueueKind } from './queue-item';
import { Worklist } from './worklist';

const TITLES: Record<QueueKind, string> = {
  clinical: 'validation.titles.clinical',
  translation: 'validation.titles.translation',
  audio: 'validation.titles.audio',
};

const STATES: readonly { value: QueueState; key: string }[] = [
  { value: 'pending', key: 'validation.states.pending' },
  { value: 'rejected', key: 'validation.states.rejected' },
  { value: 'validated', key: 'validation.states.validated' },
  { value: 'all', key: 'validation.states.all' },
];

/** Typing in a field is never a shortcut. */
const isField = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable);

/**
 * A validation queue worked one item at a time: everything needed to decide, the decision, and
 * the next item already in place. One flow for the three queues; only the card differs.
 */
@Component({
  selector: 'app-validation-page',
  imports: [
    FormField,
    RouterLink,
    TranslocoPipe,
    Loading,
    LoadError,
    ValidationBadge,
    ClinicalCard,
    TranslationCard,
    AudioCard,
  ],
  providers: [Worklist],
  host: { '(document:keydown)': 'onKey($event)' },
  templateUrl: './validation-page.html',
  styleUrl: './validation-page.scss',
})
export class ValidationPage {
  protected readonly worklist = inject(Worklist);
  readonly #catalog = inject(CatalogApi);

  readonly kind = input.required<QueueKind>();

  protected readonly title = computed(() => TITLES[this.kind()]);
  protected readonly states = STATES;

  protected readonly projects = resource({ loader: () => this.#catalog.projects() });
  protected readonly projectId = signal('');
  protected readonly themes = resource({
    params: () => this.projectId() || undefined,
    loader: async ({ params: projectId }) => {
      const protocols = await this.#catalog.protocols(projectId);
      const nested = await Promise.all(
        protocols.map(async (protocol) =>
          (await this.#catalog.themes(protocol.id)).map((theme) => ({
            id: theme.id,
            label: `${protocol.name} › ${theme.name}`,
          })),
        ),
      );
      return nested.flat();
    },
  });
  readonly #languages = resource({ loader: () => this.#catalog.languages() });

  readonly #note = signal({ text: '' });
  protected readonly note = form(this.#note);
  private readonly noteField = viewChild<ElementRef<HTMLTextAreaElement>>('noteField');

  constructor() {
    effect(() => {
      const kind = this.kind();
      untracked(() => this.worklist.open(kind));
    });
  }

  protected languageName(code: string): string {
    const languages = this.#languages.hasValue() ? this.#languages.value() : undefined;
    return languages?.byCode(code)?.name ?? code.toUpperCase();
  }

  protected changeState(state: string): void {
    this.worklist.filter({ ...this.worklist.filterState(), state: state as QueueState });
  }

  protected changeProject(projectId: string): void {
    this.projectId.set(projectId);
    this.worklist.filter({
      state: this.worklist.filterState().state,
      projectId: projectId || undefined,
    });
  }

  protected changeTheme(themeId: string): void {
    this.worklist.filter({ ...this.worklist.filterState(), themeId: themeId || undefined });
  }

  protected async decide(decision: Decision): Promise<void> {
    if (await this.worklist.decide(decision, this.#note().text)) this.#note.set({ text: '' });
  }

  protected next(): void {
    this.worklist.next();
    this.#note.set({ text: '' });
  }

  protected previous(): void {
    this.worklist.previous();
    this.#note.set({ text: '' });
  }

  protected onKey(event: KeyboardEvent): void {
    if (event.ctrlKey || event.metaKey || event.altKey || isField(event.target)) return;
    if (!this.worklist.current() || this.worklist.busy()) return;
    const actions: Record<string, () => void> = {
      v: () => void this.decide('validated'),
      r: () => void this.decide('rejected'),
      n: () => this.noteField()?.nativeElement.focus(),
      j: () => this.next(),
      arrowright: () => this.next(),
      k: () => this.previous(),
      arrowleft: () => this.previous(),
    };
    const action = actions[event.key.toLowerCase()];
    if (!action) return;
    event.preventDefault();
    action();
  }
}
