import type { Schemas } from '../../api/api-types';
import { IDS, PROJECT, PROTOCOL, THEME } from '../../catalog/testing/catalog-fixtures';

const context = {
  project: { id: PROJECT.id, name: PROJECT.name },
  protocol: { id: PROTOCOL.id, name: PROTOCOL.name },
  theme: { id: THEME.id, name: THEME.name },
};

export const CLINICAL_A: Schemas['ClinicalQueueItemResponse'] = {
  ...context,
  qaset_id: IDS.qasetFr,
  concept_id: IDS.concept,
  base_language_code: 'fr',
  answer_text: 'Dormez chaque nuit sous une moustiquaire imprégnée d’insecticide.',
  variant_texts: ['Comment éviter le paludisme ?', 'Faut-il dormir sous une moustiquaire ?'],
  state: 'pending',
};

export const CLINICAL_B: Schemas['ClinicalQueueItemResponse'] = {
  ...CLINICAL_A,
  qaset_id: IDS.qaset2Fr,
  concept_id: IDS.concept2,
  answer_text: 'Videz les eaux stagnantes autour de la maison.',
  variant_texts: ['Où se reproduisent les moustiques ?'],
};

export const CLINICAL_C: Schemas['ClinicalQueueItemResponse'] = {
  ...CLINICAL_A,
  qaset_id: 'eeeeeeee-0000-0000-0000-0000000003f1',
  concept_id: 'eeeeeeee-0000-0000-0000-0000000000c3',
  answer_text: 'Consultez dès la première fièvre.',
  variant_texts: [],
};

/** A translated QASet beside the base-language one it translates. */
export const TRANSLATION_EN: Schemas['TranslationQueueItemResponse'] = {
  ...context,
  qaset_id: IDS.qasetEn,
  concept_id: IDS.concept,
  language_code: 'en',
  answer_text: 'Sleep under an insecticide-treated net every night.',
  variant_texts: ['How can I avoid malaria?'],
  base_answer_text: 'Dormez chaque nuit sous une moustiquaire imprégnée d’insecticide.',
  base_variant_texts: ['Comment éviter le paludisme ?', 'Faut-il dormir sous une moustiquaire ?'],
  state: 'pending',
};

/** A concept whose base-language QASet is gone: nothing to compare with. */
export const TRANSLATION_NO_BASE: Schemas['TranslationQueueItemResponse'] = {
  ...context,
  qaset_id: IDS.qasetBm,
  concept_id: IDS.concept,
  language_code: 'bm',
  answer_text: 'Su o su, i ka da sɔsɔ-finiw kɔrɔ.',
  variant_texts: [],
  base_answer_text: null,
  base_variant_texts: [],
  state: 'pending',
};

export const AUDIO_ITEM: Schemas['AudioQueueItemResponse'] = {
  ...context,
  qaset_id: IDS.qasetFr,
  concept_id: IDS.concept,
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
