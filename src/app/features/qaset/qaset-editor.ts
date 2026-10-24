import { Injectable, PendingTasks, computed, inject, resource, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  AUTHOR_QASETS,
  CurrentUser,
  MANAGE_CATEGORIES,
  MANAGE_INTENTS,
} from '../../core/access/current-user';
import { CatalogApi } from '../../core/catalog/catalog-api';
import { QASetAuthoringApi, type TranslationEngine } from '../../core/catalog/qaset-authoring-api';
import type { Language } from '../../core/catalog/catalog.model';
import { TaxonomyApi } from '../../core/catalog/taxonomy-api';
import { trailOf } from '../../core/catalog/trail';
import { writeFailureOf } from '../../core/error/write-failure';
import { Translator } from '../../core/i18n/translator';
import { linkCandidates, toQASetView, type ItemRole, type LinkCandidate } from './qaset-view';
import { validationResets, type ValidationReset } from './validation-resets';

/** When to re-read the QASet after a call. */
type Reread = 'never' | 'on-success' | 'always';

type Outcome<T> = { readonly ok: true; readonly value: T } | { readonly ok: false };

const RESET_KEYS = {
  clinical: 'authoring.reset.clinical',
  'translation:answer': 'authoring.reset.translationAnswer',
  'translation:variant': 'authoring.reset.translationVariant',
  'audio:answer': 'authoring.reset.audioAnswer',
  'audio:variant': 'authoring.reset.audioVariant',
} as const;

/**
 * The QASet page's state and its writes. Every write takes the same path: call the engine, then
 * re-read the QASet so whatever the engine reset is what renders. A refusal is kept against the
 * control that caused it; a target that turned out to be gone re-reads the page instead.
 */
@Injectable()
export class QASetEditor {
  readonly #catalog = inject(CatalogApi);
  readonly #authoring = inject(QASetAuthoringApi);
  readonly #translator = inject(Translator);
  readonly #router = inject(Router);
  readonly #tasks = inject(PendingTasks);

  readonly #taxonomy = inject(TaxonomyApi);
  readonly #user = inject(CurrentUser);

  readonly qasetId = signal<string | undefined>(undefined);
  readonly canAuthor = this.#user.can(AUTHOR_QASETS);
  /** Creating a catalogue entry is its own permission; attaching an existing one is authoring. */
  readonly canCreateIntents = this.#user.can(MANAGE_INTENTS);
  readonly canCreateCategories = this.#user.can(MANAGE_CATEGORIES);

  readonly searchIntents = (prefix: string) => this.#taxonomy.searchIntents(prefix);
  readonly searchCategories = (prefix: string) => this.#taxonomy.searchCategories(prefix);

  readonly #detail = resource({
    params: () => this.qasetId(),
    loader: ({ params }) => this.#catalog.qaset(params),
  });

  // A computed in between, so re-reading the same QASet does not re-read its lineage: `resource`
  // reloads on every change of its params function, while a computed only notifies on a new value.
  readonly #themeId = computed(() =>
    this.#detail.hasValue() ? this.#detail.value().theme_id : undefined,
  );

  readonly #context = resource({
    params: () => this.#themeId(),
    loader: async ({ params: themeId }) => {
      const [lineage, languages] = await Promise.all([
        this.#catalog.lineageOfTheme(themeId),
        this.#catalog.languages(),
      ]);
      return { lineage, languages };
    },
  });

  readonly view = computed(() =>
    this.#detail.hasValue() && this.#context.hasValue()
      ? toQASetView(
          this.#detail.value(),
          this.#context.value().languages,
          this.#context.value().lineage.project.baseLanguageId,
        )
      : undefined,
  );
  readonly trail = computed(() =>
    this.#context.hasValue() ? trailOf(this.#context.value().lineage) : [],
  );
  readonly loadError = computed(() => this.#detail.error() ?? this.#context.error());

  /** Languages the QASet does not speak yet. */
  readonly missingLanguages = computed(() => {
    const view = this.view();
    if (!view || !this.#context.hasValue()) return [];
    const present = new Set(view.sections.map((s) => s.language.id));
    return this.#context
      .value()
      .languages.all()
      .filter((l) => !present.has(l.id));
  });

  /** A variant can only be translated into a language whose answer is already here. */
  variantTargets(sourceLanguageId: string): Language[] {
    return (this.view()?.sections ?? [])
      .map((section) => section.language)
      .filter((language) => language.id !== sourceLanguageId);
  }

  /** Counterparts an item may be linked to by hand, from what is loaded. */
  linkCandidates(role: ItemRole, itemId: string): LinkCandidate[] {
    const view = this.view();
    return view ? linkCandidates(view, role, itemId) : [];
  }

  readonly #pending = signal<string | null>(null);
  readonly busy = computed(() => this.#pending() !== null);
  readonly #errors = signal<ReadonlyMap<string, string>>(new Map());
  readonly pageAlert = signal<string | null>(null);
  readonly #resets = signal<readonly ValidationReset[]>([]);

  readonly resetMessage = computed(() => {
    const resets = this.#resets();
    if (resets.length === 0) return null;
    const list = resets.map((reset) => this.#describe(reset)).join(', ');
    return this.#translator.t('authoring.reset.message', { list });
  });

  errorFor(target: string): string | null {
    return this.#errors().get(target) ?? null;
  }

  clearError(target: string): void {
    if (!this.#errors().has(target)) return;
    this.#errors.update((errors) => {
      const next = new Map(errors);
      next.delete(target);
      return next;
    });
  }

  dismissResets(): void {
    this.#resets.set([]);
  }

  retry(): void {
    if (this.#detail.error()) this.#detail.reload();
    else this.#context.reload();
  }

  editAnswer(languageId: string, text: string): Promise<boolean> {
    return this.#run(`answer:${languageId}`, (q) =>
      this.#authoring.updateAnswer(q, languageId, text),
    );
  }

  addVariant(languageId: string, text: string): Promise<boolean> {
    return this.#run(`add-variant:${languageId}`, (q) =>
      this.#authoring.addVariant(q, languageId, text),
    );
  }

  editVariant(variantId: string, text: string): Promise<boolean> {
    return this.#run(`variant:${variantId}`, (q) =>
      this.#authoring.updateVariant(q, variantId, text),
    );
  }

  deleteVariant(variantId: string): Promise<boolean> {
    return this.#run(`variant:${variantId}`, (q) => this.#authoring.deleteVariant(q, variantId));
  }

  addLanguage(languageId: string, answerText: string): Promise<boolean> {
    return this.#run('add-language', (q) => this.#authoring.addLanguage(q, languageId, answerText));
  }

  removeLanguage(languageId: string): Promise<boolean> {
    return this.#run(`language:${languageId}`, (q) =>
      this.#authoring.removeLanguage(q, languageId),
    );
  }

  /** The one write that does not re-read: the QASet is gone, so return to its theme. */
  async deleteQASet(): Promise<boolean> {
    const themeId = this.#detail.hasValue() ? this.#detail.value().theme_id : undefined;
    const deleted = await this.#run('qaset', (q) => this.#authoring.deleteQASet(q), false);
    if (deleted && themeId) await this.#router.navigate(['/themes', themeId]);
    return deleted;
  }

  translateAnswer(
    answerId: string,
    targetLanguageId: string,
    engine: TranslationEngine,
  ): Promise<boolean> {
    return this.#run(`translate:${answerId}`, (q) =>
      this.#authoring.translateAnswer(q, answerId, targetLanguageId, engine),
    );
  }

  translateVariant(
    variantId: string,
    targetLanguageId: string,
    engine: TranslationEngine,
  ): Promise<boolean> {
    return this.#run(`translate:${variantId}`, (q) =>
      this.#authoring.translateVariant(q, variantId, targetLanguageId, engine),
    );
  }

  /** Proposals only, so nothing to re-read; null when the engine refused. */
  async generateVariants(answerId: string, context: string): Promise<string[] | null> {
    const outcome = await this.#attempt(
      `generate:${answerId}`,
      (q) => this.#authoring.generateVariants(q, answerId, context),
      'never',
    );
    return outcome.ok ? outcome.value : null;
  }

  /**
   * One add per kept candidate, in order, stopping at the first refusal. Re-read once at the end
   * either way, so the page shows exactly what was added.
   */
  async addVariants(
    answerId: string,
    languageId: string,
    texts: readonly string[],
    onAdded: (index: number) => void,
  ): Promise<boolean> {
    const outcome = await this.#attempt(
      `generate:${answerId}`,
      async (q) => {
        for (const [index, text] of texts.entries()) {
          await this.#authoring.addVariant(q, languageId, text);
          onAdded(index);
        }
      },
      'always',
    );
    return outcome.ok;
  }

  attachIntent(variantId: string, intentId: string): Promise<boolean> {
    return this.#run(`intents:${variantId}`, (q) =>
      this.#authoring.attachIntent(q, variantId, intentId),
    );
  }

  /** Get-or-create in the catalogue, then attach: one action, one re-read. */
  createIntent(variantId: string, text: string): Promise<boolean> {
    return this.#run(`intents:${variantId}`, async (q) => {
      const intentId = await this.#taxonomy.registerIntent(text);
      await this.#authoring.attachIntent(q, variantId, intentId);
    });
  }

  detachIntent(variantId: string, intentId: string): Promise<boolean> {
    return this.#run(`intents:${variantId}`, (q) =>
      this.#authoring.detachIntent(q, variantId, intentId),
    );
  }

  addCategory(categoryId: string): Promise<boolean> {
    return this.#run('categories', (q) => this.#authoring.addCategory(q, categoryId));
  }

  createCategory(name: string): Promise<boolean> {
    return this.#run('categories', async (q) => {
      const categoryId = await this.#taxonomy.registerCategory(name);
      await this.#authoring.addCategory(q, categoryId);
    });
  }

  removeCategory(categoryId: string): Promise<boolean> {
    return this.#run('categories', (q) => this.#authoring.removeCategory(q, categoryId));
  }

  link(role: ItemRole, itemId: string, counterpartId: string): Promise<boolean> {
    return this.#run(`links:${itemId}`, (q) =>
      role === 'answer'
        ? this.#authoring.linkAnswers(q, itemId, counterpartId)
        : this.#authoring.linkVariants(q, itemId, counterpartId),
    );
  }

  unlink(role: ItemRole, itemId: string, linkId: string): Promise<boolean> {
    return this.#run(`links:${itemId}`, (q) =>
      role === 'answer'
        ? this.#authoring.unlinkAnswers(q, linkId)
        : this.#authoring.unlinkVariants(q, linkId),
    );
  }

  async #run(
    target: string,
    write: (qasetId: string) => Promise<unknown>,
    reread = true,
  ): Promise<boolean> {
    return (await this.#attempt(target, write, reread ? 'on-success' : 'never')).ok;
  }

  async #attempt<T>(
    target: string,
    call: (qasetId: string) => Promise<T>,
    reread: Reread,
  ): Promise<Outcome<T>> {
    const qasetId = this.qasetId();
    if (qasetId === undefined || this.busy()) return { ok: false };

    // Held as a pending task, so the app (and a test) is only stable once the re-read has landed.
    const done = this.#tasks.add();
    this.#pending.set(target);
    this.clearError(target);
    this.pageAlert.set(null);
    this.#resets.set([]);
    try {
      const value = await call(qasetId);
      if (reread !== 'never') await this.#reread(qasetId, true);
      return { ok: true, value };
    } catch (error) {
      const failure = writeFailureOf(error);
      const message = this.#translator.t(failure.key);
      if (failure.gone) {
        this.pageAlert.set(message);
        await this.#reread(qasetId, false);
      } else {
        this.#errors.update((errors) => new Map(errors).set(target, message));
        if (reread === 'always') await this.#reread(qasetId, true);
      }
      return { ok: false };
    } finally {
      this.#pending.set(null);
      done();
    }
  }

  /** Never throws: a failed re-read falls back to the resource's own reload and error state. */
  async #reread(qasetId: string, compare: boolean): Promise<void> {
    const before = this.view();
    try {
      this.#detail.set(await this.#catalog.qaset(qasetId));
    } catch {
      this.#detail.reload();
      return;
    }
    const after = this.view();
    if (compare && before && after) this.#resets.set(validationResets(before, after));
  }

  #describe(reset: ValidationReset): string {
    if (reset.kind === 'clinical') return this.#translator.t(RESET_KEYS.clinical);
    return this.#translator.t(RESET_KEYS[`${reset.kind}:${reset.item}`], {
      language: reset.language,
      number: reset.number,
    });
  }
}
