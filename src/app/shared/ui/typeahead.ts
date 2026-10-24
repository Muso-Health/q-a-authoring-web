import {
  Component,
  ElementRef,
  afterNextRender,
  computed,
  input,
  output,
  resource,
  signal,
  viewChild,
} from '@angular/core';
import { FormField, form } from '@angular/forms/signals';
import { TranslocoPipe } from '@jsverse/transloco';

export interface TypeaheadOption {
  readonly id: string;
  readonly label: string;
}

type Choice =
  { readonly kind: 'pick'; readonly option: TypeaheadOption } | { readonly kind: 'create' };

const SEARCH_DELAY_MS = 200;

const normalized = (text: string): string => text.trim().replace(/\s+/g, ' ').toLowerCase();

const pause = (ms: number, signal: AbortSignal): Promise<void> =>
  new Promise((done, fail) => {
    const timer = setTimeout(done, ms);
    signal.addEventListener('abort', () => {
      clearTimeout(timer);
      fail(signal.reason);
    });
  });

let nextId = 0;

/**
 * Pick an entry of a catalogue by typing its start, or — where allowed — create the typed text.
 * An exact match (case and space insensitive) is always reused rather than offered for creation.
 * The ARIA 1.2 combobox pattern: arrows move, Enter chooses, Escape closes.
 */
@Component({
  selector: 'app-typeahead',
  imports: [FormField, TranslocoPipe],
  template: `
    <div class="typeahead" (keydown.escape)="cancel.emit()">
      <label [for]="id">{{ label() }}</label>
      <input
        #field
        type="text"
        role="combobox"
        autocomplete="off"
        aria-autocomplete="list"
        [id]="id"
        [formField]="query.text"
        [attr.aria-expanded]="choices().length > 0"
        [attr.aria-controls]="id + '-list'"
        [attr.aria-activedescendant]="active() >= 0 ? id + '-option-' + active() : null"
        (keydown)="onKey($event)"
      />
      @if (choices().length > 0) {
        <ul role="listbox" [id]="id + '-list'" [attr.aria-label]="label()">
          @for (choice of choices(); track $index; let i = $index) {
            <li
              role="option"
              [id]="id + '-option-' + i"
              [attr.aria-selected]="i === active()"
              [class.create]="choice.kind === 'create'"
              (mousedown)="$event.preventDefault()"
              (click)="choose(choice)"
            >
              @if (choice.kind === 'pick') {
                {{ choice.option.label }}
              } @else {
                {{ 'typeahead.create' | transloco: { text: typed() } }}
              }
            </li>
          }
        </ul>
      }
      <div class="status" aria-live="polite">
        @if (results.isLoading()) {
          <p class="muso-meta">{{ 'typeahead.searching' | transloco }}</p>
        } @else if (alreadyAttached(); as label) {
          <p class="muso-meta">{{ 'typeahead.alreadyAttached' | transloco: { label } }}</p>
        } @else if (results.hasValue() && choices().length === 0) {
          <p class="muso-meta">{{ 'typeahead.noResult' | transloco }}</p>
        }
      </div>
      @if (results.error()) {
        <p class="field-error" role="alert">{{ 'typeahead.searchFailed' | transloco }}</p>
      }
      @if (error(); as message) {
        <p class="field-error" role="alert">{{ message }}</p>
      }
      <button type="button" class="secondary" (click)="cancel.emit()">
        {{ 'typeahead.close' | transloco }}
      </button>
    </div>
  `,
  styles: `
    .typeahead {
      display: grid;
      gap: var(--muso-space-1);
      max-inline-size: 32rem;
    }
    input {
      inline-size: 100%;
    }
    ul {
      margin: 0;
      padding: var(--muso-space-1) 0;
      list-style: none;
      border: 1px solid var(--muso-border-strong);
      border-radius: var(--muso-radius);
      background: var(--muso-surface);
    }
    li {
      padding: var(--muso-space-1) var(--muso-space-2);
      cursor: pointer;
    }
    li[aria-selected='true'],
    li:hover {
      background: var(--muso-teal-12);
    }
    .create {
      font-weight: 600;
    }
    .status p {
      margin: 0;
    }
    button {
      justify-self: start;
    }
  `,
})
export class Typeahead {
  protected readonly id = `typeahead-${nextId++}`;

  readonly label = input.required<string>();
  readonly search = input.required<(prefix: string) => Promise<readonly TypeaheadOption[]>>();
  /** Ids already attached: never suggested again. */
  readonly exclude = input<readonly string[]>([]);
  readonly canCreate = input(false);
  /** The engine's refusal, already translated. */
  readonly error = input<string | null>(null);
  readonly picked = output<TypeaheadOption>();
  readonly created = output<string>();
  readonly cancel = output();

  readonly #model = signal({ text: '' });
  protected readonly query = form(this.#model);
  protected readonly typed = computed(() => this.#model().text.trim().replace(/\s+/g, ' '));

  protected readonly results = resource({
    params: () => this.typed() || undefined,
    loader: async ({ params: prefix, abortSignal }) => {
      await pause(SEARCH_DELAY_MS, abortSignal);
      return this.search()(prefix);
    },
  });

  readonly #found = computed(() => (this.results.hasValue() ? this.results.value() : []));
  readonly #exact = computed(() =>
    this.#found().find((option) => normalized(option.label) === normalized(this.typed())),
  );
  protected readonly alreadyAttached = computed(() => {
    const exact = this.#exact();
    return exact && this.exclude().includes(exact.id) ? exact.label : null;
  });
  protected readonly choices = computed<Choice[]>(() => {
    if (this.typed() === '' || !this.results.hasValue()) return [];
    const picks = this.#found()
      .filter((option) => !this.exclude().includes(option.id))
      .map((option) => ({ kind: 'pick' as const, option }));
    const create = this.canCreate() && !this.#exact() ? [{ kind: 'create' as const }] : [];
    return [...picks, ...create];
  });
  protected readonly active = signal(-1);

  private readonly field = viewChild.required<ElementRef<HTMLInputElement>>('field');

  constructor() {
    afterNextRender(() => this.field().nativeElement.focus());
  }

  protected onKey(event: KeyboardEvent): void {
    const count = this.choices().length;
    if (event.key === 'ArrowDown' && count > 0) {
      event.preventDefault();
      this.active.update((i) => (i + 1) % count);
    } else if (event.key === 'ArrowUp' && count > 0) {
      event.preventDefault();
      this.active.update((i) => (i <= 0 ? count - 1 : i - 1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const choice = this.choices()[this.active()] ?? this.choices()[0];
      if (choice) this.choose(choice);
    } else {
      this.active.set(-1);
    }
  }

  protected choose(choice: Choice): void {
    if (choice.kind === 'pick') this.picked.emit(choice.option);
    else this.created.emit(this.typed());
  }
}
