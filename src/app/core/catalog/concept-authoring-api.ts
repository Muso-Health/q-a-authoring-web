import { Service, inject } from '@angular/core';
import { ApiPort } from '../api/api-port';
import type { Schemas } from '../api/api-types';

const id = encodeURIComponent;
const text = (value: string): Schemas['TextRequest'] => ({ text: value });
const answerIn = (languageId: string, answerText: string): Schemas['AnswerInLanguageRequest'] => ({
  language_id: languageId,
  answer_text: answerText,
});

/** A question and its answer, written in the project's base language: the API takes no language. */
export interface QAPair {
  readonly question: string;
  readonly answer: string;
}

/** What a batch of pairs did. `skippedRows` index the batch as sent: questions already there. */
export interface AuthoredPairs {
  readonly conceptsCreated: number;
  readonly conceptsUpdated: number;
  readonly variantsAdded: number;
  readonly skippedRows: readonly number[];
}

export const TRANSLATION_ENGINES = ['llm', 'google'] as const;
export type TranslationEngine = (typeof TRANSLATION_ENGINES)[number];

const translate = (
  targetLanguageId: string,
  engine: TranslationEngine,
): Schemas['TranslateRequest'] => ({ target_language_id: targetLanguageId, engine });

/**
 * Writes to a concept and to its per-language QASets. Callers re-read the concept afterwards.
 * A concept starts in the project's base language; other languages come by translation or by
 * writing their answer.
 */
@Service()
export class ConceptAuthoringApi {
  readonly #api = inject(ApiPort);

  /** Pairs sharing an answer become one concept; an answer the theme already has gains questions. */
  async authorPairs(themeId: string, pairs: readonly QAPair[]): Promise<AuthoredPairs> {
    const body: Schemas['QAPairRequest'][] = pairs.map(({ question, answer }) => ({
      question,
      answer,
    }));
    const result = await this.#api.post<Schemas['AuthoredPairsResponse']>(
      `/themes/${id(themeId)}/qa-pairs`,
      body,
    );
    return {
      conceptsCreated: result.concepts_created,
      conceptsUpdated: result.concepts_updated,
      variantsAdded: result.variants_added,
      skippedRows: result.skipped_rows,
    };
  }

  /** The new concept's id. */
  async createConcept(themeId: string, languageId: string, answerText: string): Promise<string> {
    const path = `/themes/${id(themeId)}/concepts`;
    return (
      await this.#api.post<Schemas['ConceptResponse']>(path, answerIn(languageId, answerText))
    ).id;
  }

  deleteConcept(conceptId: string): Promise<void> {
    return this.#api.delete(`/concepts/${id(conceptId)}`);
  }

  /** Gives the concept a QASet in another of its project's languages. */
  async addQASet(conceptId: string, languageId: string, answerText: string): Promise<void> {
    await this.#api.post(`/concepts/${id(conceptId)}/qasets`, answerIn(languageId, answerText));
  }

  /** Removes one language of the concept; the engine refuses the base language's. */
  deleteQASet(qasetId: string): Promise<void> {
    return this.#api.delete(`/qasets/${id(qasetId)}`);
  }

  async updateAnswer(qasetId: string, answerText: string): Promise<void> {
    await this.#api.patch(`/qasets/${id(qasetId)}/answer`, text(answerText));
  }

  async addVariant(qasetId: string, variantText: string): Promise<void> {
    await this.#api.post(`/qasets/${id(qasetId)}/variants`, text(variantText));
  }

  async updateVariant(qasetId: string, variantId: string, variantText: string): Promise<void> {
    await this.#api.patch(`/qasets/${id(qasetId)}/variants/${id(variantId)}`, text(variantText));
  }

  deleteVariant(qasetId: string, variantId: string): Promise<void> {
    return this.#api.delete(`/qasets/${id(qasetId)}/variants/${id(variantId)}`);
  }

  /** Creates the target language's QASet from the base one, or updates it if it is there. */
  async translateConcept(
    conceptId: string,
    targetLanguageId: string,
    engine: TranslationEngine,
  ): Promise<void> {
    await this.#api.post(
      `/concepts/${id(conceptId)}/translate`,
      translate(targetLanguageId, engine),
    );
  }

  /** Adds the variant's translation to the concept's QASet in that language, which must exist. */
  async translateVariant(
    qasetId: string,
    variantId: string,
    targetLanguageId: string,
    engine: TranslationEngine,
  ): Promise<void> {
    const path = `/qasets/${id(qasetId)}/variants/${id(variantId)}/translate`;
    await this.#api.post(path, translate(targetLanguageId, engine));
  }

  /** Proposals only, in the QASet's language: nothing is saved until each kept one is added. */
  async generateVariants(qasetId: string, context: string): Promise<string[]> {
    const path = `/qasets/${id(qasetId)}/generate-variants`;
    const body: Schemas['GenerateVariantsRequest'] = { context };
    return (await this.#api.post<Schemas['GeneratedVariantsResponse']>(path, body)).candidates;
  }

  async attachIntent(conceptId: string, intentId: string): Promise<void> {
    const body: Schemas['AttachIntentRequest'] = { intent_id: intentId };
    await this.#api.post(`/concepts/${id(conceptId)}/intents`, body);
  }

  detachIntent(conceptId: string, intentId: string): Promise<void> {
    return this.#api.delete(`/concepts/${id(conceptId)}/intents/${id(intentId)}`);
  }

  async addCategory(conceptId: string, categoryId: string): Promise<void> {
    const body: Schemas['AddCategoryRequest'] = { category_id: categoryId };
    await this.#api.post(`/concepts/${id(conceptId)}/categories`, body);
  }

  removeCategory(conceptId: string, categoryId: string): Promise<void> {
    return this.#api.delete(`/concepts/${id(conceptId)}/categories/${id(categoryId)}`);
  }
}
