import {
  Injectable,
  PendingTasks,
  computed,
  inject,
  signal,
  type WritableResource,
} from '@angular/core';
import { placeholderProblemsOf, writeFailureOf } from '../../core/error/write-failure';
import { Translator } from '../../core/i18n/translator';

/**
 * The administration's call-then-refetch: one write at a time, its refusal kept where it was
 * made, and the list or entity re-read once the engine has answered.
 */
@Injectable()
export class AdminWrites {
  readonly #translator = inject(Translator);
  readonly #tasks = inject(PendingTasks);

  readonly #pending = signal<string | null>(null);
  readonly #errors = signal<ReadonlyMap<string, unknown>>(new Map());

  readonly busy = computed(() => this.#pending() !== null);
  /** What made the page stale (the target vanished), shown once above it. */
  readonly notice = signal<string | null>(null);

  errorFor(target: string): string | null {
    const error = this.#errors().get(target);
    return error === undefined ? null : this.#translator.t(writeFailureOf(error).key);
  }

  problemsFor(target: string) {
    return placeholderProblemsOf(this.#errors().get(target));
  }

  clearError(target: string): void {
    if (!this.#errors().has(target)) return;
    this.#errors.update((errors) => {
      const next = new Map(errors);
      next.delete(target);
      return next;
    });
  }

  async run(
    target: string,
    call: () => Promise<unknown>,
    refetch: () => Promise<unknown>,
  ): Promise<boolean> {
    if (this.busy()) return false;
    // Held as a pending task, so the app (and a test) is only stable once the re-read has landed.
    const done = this.#tasks.add();
    this.#pending.set(target);
    this.clearError(target);
    this.notice.set(null);
    try {
      await call();
      await refetch();
      return true;
    } catch (error) {
      const failure = writeFailureOf(error);
      if (failure.gone) {
        this.notice.set(this.#translator.t(failure.key));
        await refetch();
      } else {
        this.#errors.update((errors) => new Map(errors).set(target, error));
      }
      return false;
    } finally {
      this.#pending.set(null);
      done();
    }
  }
}

/** Re-reads into a resource; a failed re-read falls back to the resource's own reload and error. */
export async function reread<T>(
  target: WritableResource<T>,
  load: () => Promise<T>,
): Promise<void> {
  try {
    target.set(await load());
  } catch {
    target.reload();
  }
}
