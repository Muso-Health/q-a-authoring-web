import { Service, inject } from '@angular/core';
import { ApiPort } from '../api/api-port';
import type { Schemas } from '../api/api-types';

const id = encodeURIComponent;
const text = (value: string): Schemas['TextRequest'] => ({ text: value });
const answerIn = (languageId: string, answerText: string): Schemas['AnswerInLanguageRequest'] => ({
  language_id: languageId,
  answer_text: answerText,
});

export const TRANSLATION_ENGINES = ['llm', 'google'] as const;
export type TranslationEngine = (typeof TRANSLATION_ENGINES)[number];

const translate = (
  targetLanguageId: string,
  engine: TranslationEngine,
): Schemas['TranslateRequest'] => ({ target_language_id: targetLanguageId, engine });

/** Writes to a QASet's text content. Callers re-read the QASet afterwards. */
@Service()
export class QASetAuthoringApi {
  readonly #api = inject(ApiPort);

  async createQASet(themeId: string, languageId: string, answerText: string): Promise<string> {
    const path = `/themes/${id(themeId)}/qasets`;
    return (await this.#api.post<Schemas['QASetResponse']>(path, answerIn(languageId, answerText)))
      .id;
  }

  deleteQASet(qasetId: string): Promise<void> {
    return this.#api.delete(`/qasets/${id(qasetId)}`);
  }

  async updateAnswer(qasetId: string, languageId: string, answerText: string): Promise<void> {
    await this.#api.patch(`/qasets/${id(qasetId)}/languages/${id(languageId)}`, text(answerText));
  }

  async addLanguage(qasetId: string, languageId: string, answerText: string): Promise<void> {
    await this.#api.post(`/qasets/${id(qasetId)}/languages`, answerIn(languageId, answerText));
  }

  removeLanguage(qasetId: string, languageId: string): Promise<void> {
    return this.#api.delete(`/qasets/${id(qasetId)}/languages/${id(languageId)}`);
  }

  async addVariant(qasetId: string, languageId: string, variantText: string): Promise<void> {
    const path = `/qasets/${id(qasetId)}/languages/${id(languageId)}/variants`;
    await this.#api.post(path, text(variantText));
  }

  async updateVariant(qasetId: string, variantId: string, variantText: string): Promise<void> {
    await this.#api.patch(`/qasets/${id(qasetId)}/variants/${id(variantId)}`, text(variantText));
  }

  deleteVariant(qasetId: string, variantId: string): Promise<void> {
    return this.#api.delete(`/qasets/${id(qasetId)}/variants/${id(variantId)}`);
  }

  /** Creates the answer in the target language and links it to the source. */
  async translateAnswer(
    qasetId: string,
    answerId: string,
    targetLanguageId: string,
    engine: TranslationEngine,
  ): Promise<void> {
    const path = `/qasets/${id(qasetId)}/answers/${id(answerId)}/translate`;
    await this.#api.post(path, translate(targetLanguageId, engine));
  }

  /** Creates the variant in a language that already has an answer, and links it to the source. */
  async translateVariant(
    qasetId: string,
    variantId: string,
    targetLanguageId: string,
    engine: TranslationEngine,
  ): Promise<void> {
    const path = `/qasets/${id(qasetId)}/variants/${id(variantId)}/translate`;
    await this.#api.post(path, translate(targetLanguageId, engine));
  }

  /** Proposals only: nothing is saved until each kept one is added as a variant. */
  async generateVariants(qasetId: string, answerId: string, context: string): Promise<string[]> {
    const path = `/qasets/${id(qasetId)}/answers/${id(answerId)}/generate-variants`;
    const body: Schemas['GenerateVariantsRequest'] = { context };
    return (await this.#api.post<Schemas['GeneratedVariantsResponse']>(path, body)).candidates;
  }

  async attachIntent(qasetId: string, variantId: string, intentId: string): Promise<void> {
    const body: Schemas['AttachIntentRequest'] = { intent_id: intentId };
    await this.#api.post(`/qasets/${id(qasetId)}/variants/${id(variantId)}/intents`, body);
  }

  detachIntent(qasetId: string, variantId: string, intentId: string): Promise<void> {
    return this.#api.delete(
      `/qasets/${id(qasetId)}/variants/${id(variantId)}/intents/${id(intentId)}`,
    );
  }

  async addCategory(qasetId: string, categoryId: string): Promise<void> {
    const body: Schemas['AddCategoryRequest'] = { category_id: categoryId };
    await this.#api.post(`/qasets/${id(qasetId)}/categories`, body);
  }

  removeCategory(qasetId: string, categoryId: string): Promise<void> {
    return this.#api.delete(`/qasets/${id(qasetId)}/categories/${id(categoryId)}`);
  }

  async linkAnswers(qasetId: string, answerId: string, otherAnswerId: string): Promise<void> {
    const body: Schemas['LinkAnswersRequest'] = {
      answer_a_id: answerId,
      answer_b_id: otherAnswerId,
    };
    await this.#api.post(`/qasets/${id(qasetId)}/answer-links`, body);
  }

  async linkVariants(qasetId: string, variantId: string, otherVariantId: string): Promise<void> {
    const body: Schemas['LinkVariantsRequest'] = {
      variant_a_id: variantId,
      variant_b_id: otherVariantId,
    };
    await this.#api.post(`/qasets/${id(qasetId)}/variant-links`, body);
  }

  unlinkAnswers(qasetId: string, linkId: string): Promise<void> {
    return this.#api.delete(`/qasets/${id(qasetId)}/answer-links/${id(linkId)}`);
  }

  unlinkVariants(qasetId: string, linkId: string): Promise<void> {
    return this.#api.delete(`/qasets/${id(qasetId)}/variant-links/${id(linkId)}`);
  }
}
