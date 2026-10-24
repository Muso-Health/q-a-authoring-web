import type { Schemas } from '../../core/api/api-types';
import {
  toValidationStatus,
  type Language,
  type LanguageDirectory,
  type QASetDetail,
  type ValidationStatus,
} from '../../core/catalog/catalog.model';

export interface AudioView {
  readonly id: string;
  readonly durationMs: number;
  readonly quality: ValidationStatus;
}

export interface TranslationLinkView {
  readonly linkId: string;
  readonly otherId: string;
  readonly language: Language;
}

export interface ItemView {
  readonly id: string;
  readonly text: string;
  readonly audio: AudioView | null;
  readonly links: readonly TranslationLinkView[];
  /** Null where translation validation does not apply: the project's base language. */
  readonly translation: ValidationStatus | null;
}

export interface VariantView extends ItemView {
  readonly intents: readonly { readonly id: string; readonly text: string }[];
}

export interface LanguageCounts {
  readonly variants: number;
  readonly variantsWithAudio: number;
  readonly answerHasAudio: boolean;
}

export interface LanguageSectionView {
  readonly language: Language;
  readonly isBase: boolean;
  readonly answer: ItemView;
  readonly variants: readonly VariantView[];
  readonly counts: LanguageCounts;
}

export interface QASetView {
  readonly id: string;
  /** The first base-language question, or null when there is none yet. */
  readonly title: string | null;
  readonly clinical: ValidationStatus;
  readonly categories: readonly { readonly id: string; readonly name: string }[];
  readonly sections: readonly LanguageSectionView[];
}

type Presence = Schemas['LanguagePresenceResponse'];
type Item = Schemas['AnswerResponse'] | Schemas['QuestionVariantResponse'];

/** The QASet grouped by language for reading: base language first, engine order otherwise. */
export function toQASetView(
  detail: QASetDetail,
  languages: LanguageDirectory,
  baseLanguageId: string,
): QASetView {
  const item = (source: Item, isBase: boolean): ItemView => ({
    id: source.id,
    text: source.text,
    audio: source.audio && {
      id: source.audio.audio_id,
      durationMs: source.audio.duration_ms,
      quality: toValidationStatus(source.audio.audio_validation),
    },
    links: source.links.map((link) => ({
      linkId: link.link_id,
      otherId: link.other_id,
      language: languages.of(link.other_language_id),
    })),
    translation: isBase ? null : toValidationStatus(source.translation_validation),
  });

  const section = (presence: Presence): LanguageSectionView => {
    const isBase = presence.language_id === baseLanguageId;
    const variants = presence.variants.map((variant) => ({
      ...item(variant, isBase),
      intents: variant.intents.map((intent) => ({ id: intent.intent_id, text: intent.text })),
    }));
    return {
      language: languages.of(presence.language_id),
      isBase,
      answer: item(presence.answer, isBase),
      variants,
      counts: {
        variants: variants.length,
        variantsWithAudio: variants.filter((variant) => variant.audio !== null).length,
        answerHasAudio: presence.answer.audio !== null,
      },
    };
  };

  const sections = [
    ...detail.languages.filter((p) => p.language_id === baseLanguageId),
    ...detail.languages.filter((p) => p.language_id !== baseLanguageId),
  ].map(section);

  return {
    id: detail.id,
    title: sections.find((s) => s.isBase)?.variants[0]?.text ?? null,
    clinical: toValidationStatus(detail.clinical_validation),
    categories: detail.categories.map((c) => ({ id: c.category_id, name: c.name })),
    sections,
  };
}

export type ItemRole = 'answer' | 'variant';

export interface LinkCandidate {
  readonly id: string;
  readonly text: string;
  readonly language: Language;
}

/**
 * What an item may be linked to by hand, read off the loaded QASet: the same role, in another
 * language, not itself, and not already linked to it.
 */
export function linkCandidates(view: QASetView, role: ItemRole, itemId: string): LinkCandidate[] {
  const items = (section: LanguageSectionView): readonly ItemView[] =>
    role === 'answer' ? [section.answer] : section.variants;
  const owner = view.sections.find((section) => items(section).some((i) => i.id === itemId));
  if (!owner) return [];
  const linked = new Set(
    items(owner)
      .find((i) => i.id === itemId)!
      .links.map((l) => l.otherId),
  );
  return view.sections
    .filter((section) => section.language.id !== owner.language.id)
    .flatMap((section) =>
      items(section)
        .filter((candidate) => !linked.has(candidate.id))
        .map((candidate) => ({
          id: candidate.id,
          text: candidate.text,
          language: section.language,
        })),
    );
}
