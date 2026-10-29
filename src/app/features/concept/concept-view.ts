import type { Schemas } from '../../core/api/api-types';
import {
  toValidationStatus,
  type ConceptDetail,
  type Language,
  type LanguageDirectory,
  type ValidationStatus,
} from '../../core/catalog/catalog.model';

/** One recording of an item, in one voice. */
export interface AudioView {
  readonly id: string;
  readonly voiceId: string;
  readonly voiceName: string;
  readonly durationMs: number;
  readonly quality: ValidationStatus;
}

export interface ItemView {
  readonly id: string;
  readonly text: string;
  /** At most one per voice, in the engine's order. */
  readonly audios: readonly AudioView[];
}

export interface LanguageCounts {
  readonly variants: number;
  readonly variantsWithAudio: number;
  readonly answerHasAudio: boolean;
}

/** One QASet of the concept: its language's answer and question variants. */
export interface QASetSectionView {
  readonly id: string;
  readonly language: Language;
  readonly isBase: boolean;
  readonly answer: ItemView;
  readonly variants: readonly ItemView[];
  readonly counts: LanguageCounts;
  /** Only the base-language QASet is validated clinically. */
  readonly clinical: ValidationStatus | null;
  /** Every other QASet is validated as a translation, answer and variants together. */
  readonly translation: ValidationStatus | null;
}

export interface Tag {
  readonly id: string;
  readonly label: string;
}

export interface ConceptView {
  readonly id: string;
  readonly themeId: string;
  /** The first base-language question, or null when there is none yet. */
  readonly title: string | null;
  readonly intents: readonly Tag[];
  readonly categories: readonly Tag[];
  readonly sections: readonly QASetSectionView[];
}

export type ItemRole = 'answer' | 'variant';

type Item = Schemas['AnswerResponse'] | Schemas['QuestionVariantResponse'];

const item = (source: Item): ItemView => ({
  id: source.id,
  text: source.text,
  audios: source.audios.map((audio) => ({
    id: audio.audio_id,
    voiceId: audio.voice_id,
    voiceName: audio.voice_name,
    durationMs: audio.duration_ms,
    quality: toValidationStatus(audio.audio_validation),
  })),
});

/** The concept for reading: one section per QASet, base language first, engine order otherwise. */
export function toConceptView(
  detail: ConceptDetail,
  languages: LanguageDirectory,
  baseLanguageId: string,
): ConceptView {
  const section = (qaset: Schemas['QASetResponse']): QASetSectionView => {
    const isBase = qaset.language_id === baseLanguageId;
    const variants = qaset.variants.map(item);
    return {
      id: qaset.id,
      language: languages.of(qaset.language_id),
      isBase,
      answer: item(qaset.answer),
      variants,
      counts: {
        variants: variants.length,
        variantsWithAudio: variants.filter((variant) => variant.audios.length > 0).length,
        answerHasAudio: qaset.answer.audios.length > 0,
      },
      clinical: isBase ? toValidationStatus(qaset.clinical_validation) : null,
      translation: isBase ? null : toValidationStatus(qaset.translation_validation),
    };
  };

  const sections = [
    ...detail.qasets.filter((q) => q.language_id === baseLanguageId),
    ...detail.qasets.filter((q) => q.language_id !== baseLanguageId),
  ].map(section);

  return {
    id: detail.id,
    themeId: detail.theme_id,
    title: sections.find((s) => s.isBase)?.variants[0]?.text ?? null,
    intents: detail.intents.map((i) => ({ id: i.intent_id, label: i.text })),
    categories: detail.categories.map((c) => ({ id: c.category_id, label: c.name })),
    sections,
  };
}
