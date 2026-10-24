import type { Schemas } from '../../api/api-types';
import { IDS, PROJECT, PROTOCOL, THEME } from '../../catalog/testing/catalog-fixtures';

const context = {
  project: { id: PROJECT.id, name: PROJECT.name },
  protocol: { id: PROTOCOL.id, name: PROTOCOL.name },
  theme: { id: THEME.id, name: THEME.name },
};

export const CLINICAL_A: Schemas['ClinicalQueueItemResponse'] = {
  ...context,
  qaset_id: IDS.qaset,
  base_language_code: 'fr',
  answer_text: 'Dormez chaque nuit sous une moustiquaire imprégnée d’insecticide.',
  variant_texts: ['Comment éviter le paludisme ?', 'Faut-il dormir sous une moustiquaire ?'],
  state: 'pending',
};

export const CLINICAL_B: Schemas['ClinicalQueueItemResponse'] = {
  ...CLINICAL_A,
  qaset_id: IDS.qaset2,
  answer_text: 'Videz les eaux stagnantes autour de la maison.',
  variant_texts: ['Où se reproduisent les moustiques ?'],
};

export const CLINICAL_C: Schemas['ClinicalQueueItemResponse'] = {
  ...CLINICAL_A,
  qaset_id: 'eeeeeeee-0000-0000-0000-000000000003',
  answer_text: 'Consultez dès la première fièvre.',
  variant_texts: [],
};

export const TRANSLATION_LINKED: Schemas['TranslationQueueItemResponse'] = {
  ...context,
  qaset_id: IDS.qaset,
  kind: 'variant',
  item_id: IDS.variantEn1,
  language_code: 'en',
  text: 'How can I avoid malaria?',
  sources: [{ item_id: IDS.variantFr1, text: 'Comment éviter le paludisme ?' }],
  fallback_base_answer_text: null,
  state: 'pending',
};

export const TRANSLATION_UNLINKED: Schemas['TranslationQueueItemResponse'] = {
  ...context,
  qaset_id: IDS.qaset,
  kind: 'answer',
  item_id: IDS.answerBm,
  language_code: 'bm',
  text: 'Su o su, i ka da sɔsɔ-finiw kɔrɔ.',
  sources: [],
  fallback_base_answer_text: 'Dormez chaque nuit sous une moustiquaire imprégnée d’insecticide.',
  state: 'pending',
};

export const AUDIO_ITEM: Schemas['AudioQueueItemResponse'] = {
  ...context,
  qaset_id: IDS.qaset,
  audio_id: IDS.audioVariantFr1,
  item_kind: 'variant',
  item_id: IDS.variantFr1,
  language_code: 'fr',
  text: 'Comment éviter le paludisme ?',
  state: 'pending',
};

export const page = <T>(items: T[], total: number, next_cursor: string | null = null) => ({
  items,
  total,
  next_cursor,
});

/** The query string the worklist sends for a first page, in the order it builds it. */
export const queuePath = (kind: string, extra = '') =>
  `/validation-queues/${kind}?state=pending&limit=20${extra}`;
