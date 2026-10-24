import { Injectable, PendingTasks, computed, inject, signal } from '@angular/core';
import { writeFailureOf } from '../../core/error/write-failure';
import { Translator } from '../../core/i18n/translator';
import {
  ValidationApi,
  type Decision,
  type QueueFilter,
  type QueueKind,
} from '../../core/validation/validation-api';
import { toQueueItem, type QueueItem } from './queue-item';

const ANNOUNCEMENTS: Record<Decision, string> = {
  validated: 'validation.announce.validated',
  rejected: 'validation.announce.rejected',
};

/**
 * One validation queue as a worklist: one current item, decided or skipped, then the next. A
 * decided item leaves the list, so the next one becomes current. When the current item is the
 * last one loaded, the next page is fetched — keyset pages, so removals never shift them.
 */
@Injectable()
export class Worklist {
  readonly #api = inject(ValidationApi);
  readonly #translator = inject(Translator);
  readonly #tasks = inject(PendingTasks);

  readonly #kind = signal<QueueKind | null>(null);
  readonly #filter = signal<QueueFilter>({ state: 'pending' });
  readonly filterState = this.#filter.asReadonly();

  readonly #items = signal<readonly QueueItem[]>([]);
  readonly #index = signal(0);
  readonly #total = signal(0);
  readonly #nextCursor = signal<string | null>(null);
  readonly #decided = signal(0);
  readonly #dropped = signal(0);
  readonly #loaded = signal(false);
  #generation = 0;

  readonly loading = signal(false);
  readonly loadError = signal<unknown>(null);
  readonly busy = signal(false);
  readonly decisionError = signal<string | null>(null);
  readonly notice = signal<string | null>(null);
  readonly announcement = signal('');

  readonly current = computed(() => this.#items()[this.#index()] ?? null);
  readonly total = this.#total.asReadonly();
  readonly decided = this.#decided.asReadonly();
  readonly remaining = computed(() =>
    Math.max(this.#total() - this.#decided() - this.#dropped(), 0),
  );
  readonly position = computed(() => this.#index() + 1);
  readonly canGoBack = computed(() => this.#index() > 0);
  readonly empty = computed(() => this.#loaded() && this.#total() === 0);
  readonly finished = computed(
    () => this.#loaded() && !this.loading() && this.#total() > 0 && this.current() === null,
  );

  open(kind: QueueKind): void {
    this.#kind.set(kind);
    void this.#load(true);
  }

  /** A new scope or state: start over from its first page. */
  filter(filter: QueueFilter): void {
    this.#filter.set({ state: filter.state, projectId: filter.projectId, themeId: filter.themeId });
    void this.#load(true);
  }

  reload(): void {
    void this.#load(true);
  }

  next(): void {
    if (this.#index() < this.#items().length) this.#index.update((i) => i + 1);
    this.#refillIfNeeded();
  }

  previous(): void {
    this.#index.update((i) => Math.max(0, i - 1));
  }

  async decide(decision: Decision, note: string): Promise<boolean> {
    const item = this.current();
    if (!item || this.busy()) return false;
    const done = this.#tasks.add();
    this.busy.set(true);
    this.decisionError.set(null);
    this.notice.set(null);
    try {
      await this.#api.decide(item.subject, decision, note);
      this.#remove(item.key);
      this.#decided.update((n) => n + 1);
      this.announcement.set(this.#translator.t(ANNOUNCEMENTS[decision]));
      return true;
    } catch (error) {
      const failure = writeFailureOf(error);
      if (failure.gone) {
        this.#remove(item.key);
        this.#dropped.update((n) => n + 1);
        this.notice.set(this.#translator.t('validation.errors.gone'));
      } else {
        this.decisionError.set(this.#translator.t(failure.key));
      }
      return false;
    } finally {
      this.busy.set(false);
      this.#refillIfNeeded();
      done();
    }
  }

  #remove(key: string): void {
    this.#items.update((items) => items.filter((item) => item.key !== key));
  }

  #refillIfNeeded(): void {
    const lastOrPast = this.#index() >= this.#items().length - 1;
    if (lastOrPast && this.#nextCursor() !== null && !this.loading()) void this.#load(false);
  }

  async #load(reset: boolean): Promise<void> {
    const kind = this.#kind();
    if (kind === null) return;
    const generation = ++this.#generation;
    const done = this.#tasks.add();
    this.loading.set(true);
    if (reset) {
      this.#items.set([]);
      this.#index.set(0);
      this.#decided.set(0);
      this.#dropped.set(0);
      this.#nextCursor.set(null);
      this.#loaded.set(false);
      this.loadError.set(null);
      this.decisionError.set(null);
      this.notice.set(null);
    }
    try {
      const page = await this.#api.queue(kind, {
        ...this.#filter(),
        cursor: reset ? undefined : (this.#nextCursor() ?? undefined),
      });
      if (generation !== this.#generation) return;
      const fresh = page.items.map((raw) => toQueueItem(kind, raw));
      this.#items.update((items) => {
        const known = new Set(items.map((item) => item.key));
        return [...items, ...fresh.filter((item) => !known.has(item.key))];
      });
      this.#total.set(page.total);
      this.#nextCursor.set(page.nextCursor);
      this.#loaded.set(true);
    } catch (error) {
      if (generation === this.#generation) this.loadError.set(error);
    } finally {
      if (generation === this.#generation) this.loading.set(false);
      done();
    }
  }
}
