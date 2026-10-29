import { Injectable, PendingTasks, computed, inject, resource, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  AUTHOR_QASETS,
  CurrentUser,
  MANAGE_AUDIO,
  MANAGE_CATEGORIES,
  MANAGE_INTENTS,
} from '../../core/access/current-user';
import { AudioApi } from '../../core/audio/audio-api';
import { VoicesApi } from '../../core/audio/voices-api';
import { CatalogApi } from '../../core/catalog/catalog-api';
import { LanguageDirectory, type Language } from '../../core/catalog/catalog.model';
import {
  ConceptAuthoringApi,
  type TranslationEngine,
} from '../../core/catalog/concept-authoring-api';
import { TaxonomyApi } from '../../core/catalog/taxonomy-api';
import { trailOf } from '../../core/catalog/trail';
import { writeFailureOf } from '../../core/error/write-failure';
import { Translator } from '../../core/i18n/translator';
import { toConceptView, type ItemRole } from './concept-view';
import { validationResets, type ValidationReset } from './validation-resets';

/** When to re-read the concept after a call. */
type Reread = 'never' | 'on-success' | 'always';

type Outcome<T> = { readonly ok: true; readonly value: T } | { readonly ok: false };

const RESET_KEYS = {
  clinical: 'authoring.reset.clinical',
  translation: 'authoring.reset.translation',
  'audio:answer': 'authoring.reset.audioAnswer',
  'audio:variant': 'authoring.reset.audioVariant',
} as const;

/**
 * The concept page's state and its writes. Every write takes the same path: call the engine, then
 * re-read the concept so whatever the engine reset is what renders. A refusal is kept against the
 * control that caused it; a target that turned out to be gone re-reads the page instead.
 */
@Injectable()
export class ConceptEditor {
  readonly #catalog = inject(CatalogApi);
  readonly #authoring = inject(ConceptAuthoringApi);
  readonly #translator = inject(Translator);
  readonly #router = inject(Router);
  readonly #tasks = inject(PendingTasks);

  readonly #taxonomy = inject(TaxonomyApi);
  readonly #audio = inject(AudioApi);
  readonly #voices = inject(VoicesApi);
  readonly #user = inject(CurrentUser);

  readonly conceptId = signal<string | undefined>(undefined);
  readonly canAuthor = this.#user.can(AUTHOR_QASETS);
  /** Creating a catalogue entry is its own permission; attaching an existing one is authoring. */
  readonly canCreateIntents = this.#user.can(MANAGE_INTENTS);
  readonly canCreateCategories = this.#user.can(MANAGE_CATEGORIES);
  /** Recording is its own permission, distinct from authoring text. */
  readonly canManageAudio = this.#user.can(MANAGE_AUDIO);

  readonly searchIntents = (prefix: string) => this.#taxonomy.searchIntents(prefix);
  readonly searchCategories = (prefix: string) => this.#taxonomy.searchCategories(prefix);

  readonly #detail = resource({
    params: () => this.conceptId(),
    loader: ({ params }) => this.#catalog.concept(params),
  });

  // A computed in between, so re-reading the same concept does not re-read its lineage: `resource`
  // reloads on every change of its params function, while a computed only notifies on a new value.
  readonly #themeId = computed(() =>
    this.#detail.hasValue() ? this.#detail.value().theme_id : undefined,
  );

  readonly #context = resource({
    params: () => this.#themeId(),
    loader: async ({ params: themeId }) => {
      const lineage = await this.#catalog.lineageOfTheme(themeId);
      const languages = await this.#catalog.projectLanguages(lineage.project.id);
      return { lineage, languages };
    },
  });

  /** Read only for whoever may record: every recording is made in one of them. */
  readonly #voiceList = resource({
    params: () => (this.canManageAudio() ? true : undefined),
    loader: () => this.#voices.list(),
  });
  readonly voices = computed(() => (this.#voiceList.hasValue() ? this.#voiceList.value() : []));

  /** The project's languages: the only ones a QASet of the concept may be in. */
  readonly projectLanguages = computed<readonly Language[]>(() =>
    this.#context.hasValue() ? this.#context.value().languages : [],
  );

  readonly view = computed(() => {
    if (!this.#detail.hasValue() || !this.#context.hasValue()) return undefined;
    const { lineage, languages } = this.#context.value();
    return toConceptView(
      this.#detail.value(),
      new LanguageDirectory(languages),
      lineage.project.baseLanguageId,
    );
  });
  readonly trail = computed(() =>
    this.#context.hasValue() ? trailOf(this.#context.value().lineage) : [],
  );
  readonly loadError = computed(() => this.#detail.error() ?? this.#context.error());

  /** Project languages the concept has no QASet in yet. */
  readonly missingLanguages = computed(() => {
    const view = this.view();
    if (!view) return [];
    const present = new Set(view.sections.map((s) => s.language.id));
    return this.projectLanguages().filter((l) => !present.has(l.id));
  });

  /** Translating the concept creates that language's QASet, or updates it: any but the base. */
  readonly conceptTargets = computed(() => {
    const base = this.#context.hasValue()
      ? this.#context.value().lineage.project.baseLanguageId
      : '';
    return this.projectLanguages().filter((l) => l.id !== base);
  });

  /** Only the base-language QASet is the source of a concept's translation. */
  readonly hasBase = computed(() => this.view()?.sections.some((s) => s.isBase) ?? false);

  /** A variant translates only into a language whose QASet the concept already has. */
  variantTargets(sourceLanguageId: string): Language[] {
    return (this.view()?.sections ?? [])
      .map((section) => section.language)
      .filter((language) => language.id !== sourceLanguageId);
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

  editAnswer(qasetId: string, text: string): Promise<boolean> {
    return this.#run(`answer:${qasetId}`, () => this.#authoring.updateAnswer(qasetId, text));
  }

  addVariant(qasetId: string, text: string): Promise<boolean> {
    return this.#run(`add-variant:${qasetId}`, () => this.#authoring.addVariant(qasetId, text));
  }

  editVariant(qasetId: string, variantId: string, text: string): Promise<boolean> {
    return this.#run(`variant:${variantId}`, () =>
      this.#authoring.updateVariant(qasetId, variantId, text),
    );
  }

  deleteVariant(qasetId: string, variantId: string): Promise<boolean> {
    return this.#run(`variant:${variantId}`, () =>
      this.#authoring.deleteVariant(qasetId, variantId),
    );
  }

  /** A language presence: the concept's QASet in that language, begun with its answer. */
  addLanguage(languageId: string, answerText: string): Promise<boolean> {
    return this.#run('add-language', (c) => this.#authoring.addQASet(c, languageId, answerText));
  }

  removeLanguage(qasetId: string): Promise<boolean> {
    return this.#run(`language:${qasetId}`, () => this.#authoring.deleteQASet(qasetId));
  }

  /** The one write that does not re-read: the concept is gone, so return to its theme. */
  async deleteConcept(): Promise<boolean> {
    const themeId = this.#detail.hasValue() ? this.#detail.value().theme_id : undefined;
    const deleted = await this.#run('concept', (c) => this.#authoring.deleteConcept(c), false);
    if (deleted && themeId) await this.#router.navigate(['/themes', themeId]);
    return deleted;
  }

  translateConcept(targetLanguageId: string, engine: TranslationEngine): Promise<boolean> {
    return this.#run('translate-concept', (c) =>
      this.#authoring.translateConcept(c, targetLanguageId, engine),
    );
  }

  translateVariant(
    qasetId: string,
    variantId: string,
    targetLanguageId: string,
    engine: TranslationEngine,
  ): Promise<boolean> {
    return this.#run(`translate:${variantId}`, () =>
      this.#authoring.translateVariant(qasetId, variantId, targetLanguageId, engine),
    );
  }

  /** Proposals only, so nothing to re-read; null when the engine refused. */
  async generateVariants(qasetId: string, context: string): Promise<string[] | null> {
    const outcome = await this.#attempt(
      `generate:${qasetId}`,
      () => this.#authoring.generateVariants(qasetId, context),
      'never',
    );
    return outcome.ok ? outcome.value : null;
  }

  /**
   * One add per kept candidate, in order, stopping at the first refusal. Re-read once at the end
   * either way, so the page shows exactly what was added.
   */
  async addVariants(
    qasetId: string,
    texts: readonly string[],
    onAdded: (index: number) => void,
  ): Promise<boolean> {
    const outcome = await this.#attempt(
      `generate:${qasetId}`,
      async () => {
        for (const [index, text] of texts.entries()) {
          await this.#authoring.addVariant(qasetId, text);
          onAdded(index);
        }
      },
      'always',
    );
    return outcome.ok;
  }

  attachIntent(intentId: string): Promise<boolean> {
    return this.#run('intents', (c) => this.#authoring.attachIntent(c, intentId));
  }

  /** Get-or-create in the catalogue, then attach: one action, one re-read. */
  createIntent(text: string): Promise<boolean> {
    return this.#run('intents', async (c) => {
      const intentId = await this.#taxonomy.registerIntent(text);
      await this.#authoring.attachIntent(c, intentId);
    });
  }

  detachIntent(intentId: string): Promise<boolean> {
    return this.#run('intents', (c) => this.#authoring.detachIntent(c, intentId));
  }

  addCategory(categoryId: string): Promise<boolean> {
    return this.#run('categories', (c) => this.#authoring.addCategory(c, categoryId));
  }

  createCategory(name: string): Promise<boolean> {
    return this.#run('categories', async (c) => {
      const categoryId = await this.#taxonomy.registerCategory(name);
      await this.#authoring.addCategory(c, categoryId);
    });
  }

  removeCategory(categoryId: string): Promise<boolean> {
    return this.#run('categories', (c) => this.#authoring.removeCategory(c, categoryId));
  }

  /** Sets the item's recording in that voice, or replaces it: the same call either way. */
  setAudio(
    qasetId: string,
    role: ItemRole,
    itemId: string,
    voiceId: string,
    file: Blob,
    filename: string,
  ): Promise<boolean> {
    return this.#run(`audio:${itemId}`, () =>
      this.#audio.setAudio(qasetId, role, itemId, voiceId, file, filename),
    );
  }

  deleteAudio(qasetId: string, role: ItemRole, itemId: string, voiceId: string): Promise<boolean> {
    return this.#run(`audio:${itemId}`, () =>
      this.#audio.deleteAudio(qasetId, role, itemId, voiceId),
    );
  }

  async #run(
    target: string,
    write: (conceptId: string) => Promise<unknown>,
    reread = true,
  ): Promise<boolean> {
    return (await this.#attempt(target, write, reread ? 'on-success' : 'never')).ok;
  }

  async #attempt<T>(
    target: string,
    call: (conceptId: string) => Promise<T>,
    reread: Reread,
  ): Promise<Outcome<T>> {
    const conceptId = this.conceptId();
    if (conceptId === undefined || this.busy()) return { ok: false };

    // Held as a pending task, so the app (and a test) is only stable once the re-read has landed.
    const done = this.#tasks.add();
    this.#pending.set(target);
    this.clearError(target);
    this.pageAlert.set(null);
    this.#resets.set([]);
    try {
      const value = await call(conceptId);
      if (reread !== 'never') await this.#reread(conceptId, true);
      return { ok: true, value };
    } catch (error) {
      const failure = writeFailureOf(error);
      const message = this.#translator.t(failure.key);
      if (failure.gone) {
        this.pageAlert.set(message);
        await this.#reread(conceptId, false);
      } else {
        this.#errors.update((errors) => new Map(errors).set(target, message));
        if (reread === 'always') await this.#reread(conceptId, true);
      }
      return { ok: false };
    } finally {
      this.#pending.set(null);
      done();
    }
  }

  /** Never throws: a failed re-read falls back to the resource's own reload and error state. */
  async #reread(conceptId: string, compare: boolean): Promise<void> {
    const before = this.view();
    try {
      this.#detail.set(await this.#catalog.concept(conceptId));
    } catch {
      this.#detail.reload();
      return;
    }
    const after = this.view();
    if (compare && before && after) this.#resets.set(validationResets(before, after));
  }

  #describe(reset: ValidationReset): string {
    switch (reset.kind) {
      case 'clinical':
        return this.#translator.t(RESET_KEYS.clinical);
      case 'translation':
        return this.#translator.t(RESET_KEYS.translation, { language: reset.language });
      case 'audio':
        return this.#translator.t(RESET_KEYS[`audio:${reset.item}`], {
          language: reset.language,
          number: reset.number,
          voice: reset.voice,
        });
    }
  }
}
