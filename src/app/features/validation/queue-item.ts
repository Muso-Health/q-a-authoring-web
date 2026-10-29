import type { Schemas } from '../../core/api/api-types';
import type {
  DecisionSubject,
  QueueItemResponse,
  QueueKind,
} from '../../core/validation/validation-api';
import { toValidationStatus, type ValidationStatus } from '../../core/catalog/catalog.model';

export type { QueueKind };

type NamedRef = Schemas['NamedRefResponse'];

interface Base {
  /** Unique within its queue: what a decision is about. */
  readonly key: string;
  /** Where the item is read and edited: its concept's page. */
  readonly conceptId: string;
  readonly context: {
    readonly project: NamedRef;
    readonly protocol: NamedRef;
    readonly theme: NamedRef;
  };
  readonly state: ValidationStatus;
  readonly subject: DecisionSubject;
}

export interface ClinicalItem extends Base {
  readonly kind: 'clinical';
  readonly languageCode: string;
  readonly answerText: string;
  readonly variantTexts: readonly string[];
}

/** A translated QASet, decided as a whole: its answer and variants beside the base ones. */
export interface TranslationItem extends Base {
  readonly kind: 'translation';
  readonly languageCode: string;
  readonly answerText: string;
  readonly variantTexts: readonly string[];
  /** Null when the concept has no base-language QASet to compare with. */
  readonly baseAnswerText: string | null;
  readonly baseVariantTexts: readonly string[];
}

export interface AudioItem extends Base {
  readonly kind: 'audio';
  readonly audioId: string;
  readonly itemKind: 'answer' | 'variant';
  readonly languageCode: string;
  readonly text: string;
}

export type QueueItem = ClinicalItem | TranslationItem | AudioItem;

const state = (value: string): ValidationStatus => toValidationStatus({ state: value });

export function toQueueItem<K extends QueueKind>(kind: K, raw: QueueItemResponse[K]): QueueItem {
  const context = { project: raw.project, protocol: raw.protocol, theme: raw.theme };
  switch (kind) {
    case 'clinical': {
      const item = raw as QueueItemResponse['clinical'];
      return {
        kind,
        key: item.qaset_id,
        conceptId: item.concept_id,
        context,
        state: state(item.state),
        subject: { kind: 'clinical', id: item.qaset_id },
        languageCode: item.base_language_code,
        answerText: item.answer_text,
        variantTexts: item.variant_texts,
      };
    }
    case 'translation': {
      const item = raw as QueueItemResponse['translation'];
      return {
        kind,
        key: item.qaset_id,
        conceptId: item.concept_id,
        context,
        state: state(item.state),
        subject: { kind: 'translation', id: item.qaset_id },
        languageCode: item.language_code,
        answerText: item.answer_text,
        variantTexts: item.variant_texts,
        baseAnswerText: item.base_answer_text,
        baseVariantTexts: item.base_variant_texts,
      };
    }
    default: {
      const item = raw as QueueItemResponse['audio'];
      return {
        kind: 'audio',
        key: item.audio_id,
        conceptId: item.concept_id,
        context,
        state: state(item.state),
        subject: { kind: 'audio', id: item.audio_id },
        audioId: item.audio_id,
        itemKind: item.item_kind === 'answer' ? 'answer' : 'variant',
        languageCode: item.language_code,
        text: item.text,
      };
    }
  }
}
