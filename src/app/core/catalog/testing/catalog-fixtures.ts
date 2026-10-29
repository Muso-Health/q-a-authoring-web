import type { Schemas } from '../../api/api-types';

/**
 * A small, consistent engine world: one project > protocol > theme > concept, the concept with a
 * QASet in three of the project's four languages.
 */
export const IDS = {
  fr: 'aaaaaaaa-0000-0000-0000-00000000f001',
  en: 'aaaaaaaa-0000-0000-0000-00000000e001',
  bm: 'aaaaaaaa-0000-0000-0000-00000000b001',
  ff: 'aaaaaaaa-0000-0000-0000-00000000ff01',
  /** In the catalogue, not in the project. */
  wo: 'aaaaaaaa-0000-0000-0000-0000000000a1',
  project: 'bbbbbbbb-0000-0000-0000-000000000001',
  protocol: 'cccccccc-0000-0000-0000-000000000001',
  theme: 'dddddddd-0000-0000-0000-000000000001',
  concept: 'eeeeeeee-0000-0000-0000-0000000000c1',
  concept2: 'eeeeeeee-0000-0000-0000-0000000000c2',
  qasetFr: 'eeeeeeee-0000-0000-0000-0000000000f1',
  qasetEn: 'eeeeeeee-0000-0000-0000-0000000000e1',
  qasetBm: 'eeeeeeee-0000-0000-0000-0000000000b1',
  qaset2Fr: 'eeeeeeee-0000-0000-0000-0000000002f1',
  answerFr: 'f0000000-0000-0000-0000-00000000a0f1',
  answerEn: 'f0000000-0000-0000-0000-00000000a0e1',
  answerBm: 'f0000000-0000-0000-0000-00000000a0b1',
  variantFr1: 'f0000000-0000-0000-0000-0000000001f1',
  variantFr2: 'f0000000-0000-0000-0000-0000000001f2',
  variantFr3: 'f0000000-0000-0000-0000-0000000001f3',
  variantEn1: 'f0000000-0000-0000-0000-0000000001e1',
  voiceAwa: '77777777-0000-0000-0000-0000000000a1',
  voiceMoussa: '77777777-0000-0000-0000-0000000000b1',
  audioAnswerFr: '99999999-0000-0000-0000-0000000000a1',
  audioAnswerFrMoussa: '99999999-0000-0000-0000-0000000000a5',
  audioVariantFr1: '99999999-0000-0000-0000-0000000000a2',
  audioVariantFr3: '99999999-0000-0000-0000-0000000000a3',
  audioAnswerBm: '99999999-0000-0000-0000-0000000000a4',
} as const;

export const LANGUAGES: Schemas['LanguagesResponse'] = {
  items: [
    { id: IDS.bm, code: 'bm', name: 'Bambara' },
    { id: IDS.en, code: 'en', name: 'English' },
    { id: IDS.fr, code: 'fr', name: 'Français' },
    { id: IDS.ff, code: 'ff', name: 'Peul' },
    { id: IDS.wo, code: 'wo', name: 'Wolof' },
  ],
};

/** The project's own languages: its base language first, as the engine orders them. */
export const PROJECT_LANGUAGES: Schemas['ProjectLanguagesResponse'] = {
  items: [
    { language_id: IDS.fr, code: 'fr', name: 'Français', is_base: true },
    { language_id: IDS.bm, code: 'bm', name: 'Bambara', is_base: false },
    { language_id: IDS.en, code: 'en', name: 'English', is_base: false },
    { language_id: IDS.ff, code: 'ff', name: 'Peul', is_base: false },
  ],
};

export const PROJECT: Schemas['ProjectResponse'] = {
  id: IDS.project,
  name: 'Santé communautaire Mali',
  description: 'Corpus pour les agents de santé communautaire',
  base_language_id: IDS.fr,
};

export const PROTOCOL: Schemas['ProtocolResponse'] = {
  id: IDS.protocol,
  project_id: IDS.project,
  name: 'Paludisme',
  description: null,
};

export const THEME: Schemas['ThemeResponse'] = {
  id: IDS.theme,
  protocol_id: IDS.protocol,
  name: 'Prévention',
  description: 'Moustiquaires et assainissement',
};

export const VOICES: Schemas['VoicesResponse'] = {
  items: [
    {
      id: IDS.voiceAwa,
      name: 'Awa',
      note: 'Voix féminine, Bamako',
      created_at: '2026-10-01T09:00:00Z',
      updated_at: '2026-10-01T09:00:00Z',
    },
    {
      id: IDS.voiceMoussa,
      name: 'Moussa',
      note: null,
      created_at: '2026-10-02T09:00:00Z',
      updated_at: '2026-10-02T09:00:00Z',
    },
  ],
};

const audio = (
  id: string,
  voice: 'Awa' | 'Moussa',
  durationMs: number,
  state: string | null,
): Schemas['AudioSummaryResponse'] => ({
  audio_id: id,
  voice_id: voice === 'Awa' ? IDS.voiceAwa : IDS.voiceMoussa,
  voice_name: voice,
  mime_type: 'audio/webm',
  duration_ms: durationMs,
  size_bytes: 12_000,
  checksum_sha256: '0'.repeat(64),
  audio_validation: state === null ? null : { state },
});

const variant = (
  id: string,
  qasetId: string,
  languageId: string,
  text: string,
  audios: Schemas['AudioSummaryResponse'][] = [],
): Schemas['QuestionVariantResponse'] => ({
  id,
  qaset_id: qasetId,
  language_id: languageId,
  text,
  audios,
});

export const QASET_FR: Schemas['QASetResponse'] = {
  id: IDS.qasetFr,
  concept_id: IDS.concept,
  language_id: IDS.fr,
  answer: {
    id: IDS.answerFr,
    text: 'Dormez chaque nuit sous une moustiquaire imprégnée d’insecticide.',
    audios: [
      audio(IDS.audioAnswerFr, 'Awa', 65_000, null),
      audio(IDS.audioAnswerFrMoussa, 'Moussa', 61_000, 'validated'),
    ],
  },
  variants: [
    variant(IDS.variantFr1, IDS.qasetFr, IDS.fr, 'Comment éviter le paludisme ?', [
      audio(IDS.audioVariantFr1, 'Awa', 3_000, 'validated'),
    ]),
    variant(IDS.variantFr2, IDS.qasetFr, IDS.fr, 'Faut-il dormir sous une moustiquaire ?'),
    variant(IDS.variantFr3, IDS.qasetFr, IDS.fr, 'Que faire contre les moustiques la nuit ?', [
      audio(IDS.audioVariantFr3, 'Moussa', 4_500, 'rejected'),
    ]),
  ],
  variant_count: 3,
  clinical_validation: { state: 'validated' },
  translation_validation: null,
};

export const QASET_EN: Schemas['QASetResponse'] = {
  id: IDS.qasetEn,
  concept_id: IDS.concept,
  language_id: IDS.en,
  answer: {
    id: IDS.answerEn,
    text: 'Sleep under an insecticide-treated net every night.',
    audios: [],
  },
  variants: [variant(IDS.variantEn1, IDS.qasetEn, IDS.en, 'How can I avoid malaria?')],
  variant_count: 1,
  clinical_validation: null,
  translation_validation: { state: 'rejected' },
};

export const QASET_BM: Schemas['QASetResponse'] = {
  id: IDS.qasetBm,
  concept_id: IDS.concept,
  language_id: IDS.bm,
  answer: {
    id: IDS.answerBm,
    text: 'Su o su, i ka da sɔsɔ-finiw kɔrɔ.',
    audios: [audio(IDS.audioAnswerBm, 'Awa', 70_000, 'validated')],
  },
  variants: [],
  variant_count: 0,
  clinical_validation: null,
  translation_validation: null,
};

/** The API order puts English first, to prove the page leads with the base language. */
export const CONCEPT: Schemas['ConceptResponse'] = {
  id: IDS.concept,
  theme_id: IDS.theme,
  qasets: [QASET_EN, QASET_FR, QASET_BM],
  intents: [
    { intent_id: 'i1', text: 'prévention_paludisme' },
    { intent_id: 'i2', text: 'moustiquaire' },
  ],
  categories: [
    { category_id: 'c1', name: 'Prévention' },
    { category_id: 'c2', name: 'Enfants de moins de 5 ans' },
  ],
};

export const CONCEPTS: Schemas['ConceptsResponse'] = {
  items: [
    {
      id: IDS.concept,
      theme_id: IDS.theme,
      qasets: [
        {
          id: IDS.qasetEn,
          language_id: IDS.en,
          answer_text: QASET_EN.answer.text,
          variant_count: 1,
        },
        {
          id: IDS.qasetFr,
          language_id: IDS.fr,
          answer_text: QASET_FR.answer.text,
          variant_count: 3,
        },
      ],
    },
    {
      id: IDS.concept2,
      theme_id: IDS.theme,
      qasets: [
        {
          id: IDS.qaset2Fr,
          language_id: IDS.fr,
          answer_text: 'Videz les récipients où l’eau stagne.',
          variant_count: 1,
        },
      ],
    },
  ],
};

/** The whole world as a `FakeApiPort` answer table; spread and override per test. */
export function world(): Record<string, unknown> {
  return {
    '/languages': LANGUAGES,
    '/voices': VOICES,
    '/projects': { items: [PROJECT] },
    [`/projects/${IDS.project}`]: PROJECT,
    [`/projects/${IDS.project}/languages`]: PROJECT_LANGUAGES,
    [`/projects/${IDS.project}/protocols`]: { items: [PROTOCOL] },
    [`/protocols/${IDS.protocol}`]: PROTOCOL,
    [`/protocols/${IDS.protocol}/themes`]: { items: [THEME] },
    [`/themes/${IDS.theme}`]: THEME,
    [`/themes/${IDS.theme}/concepts`]: CONCEPTS,
    [`/concepts/${IDS.concept}`]: CONCEPT,
  };
}

export const ME_AUTHOR: Schemas['MeResponse'] = {
  id: '11111111-0000-0000-0000-000000000001',
  email: 'author@example.org',
  display_name: 'Awa Traoré',
  permissions: ['author_qasets', 'manage_audio'],
  // Held everywhere: an unscoped assignment, so the global gating reads exactly as before.
  assignments: [
    {
      id: '11111111-0000-0000-0000-0000000000a1',
      role: { id: '11111111-0000-0000-0000-0000000000b1', name: 'Auteurs' },
      project: null,
      language: null,
    },
  ],
  grants: [
    { permission: 'author_qasets', project_id: null, language_id: null },
    { permission: 'manage_audio', project_id: null, language_id: null },
  ],
};

export const ME_READER: Schemas['MeResponse'] = {
  ...ME_AUTHOR,
  email: 'reader@example.org',
  permissions: ['review_clinical'],
};
