import type { Schemas } from '../../api/api-types';

/** A small, consistent engine world: one project > protocol > theme > QASet, in three languages. */
export const IDS = {
  fr: 'aaaaaaaa-0000-0000-0000-00000000f001',
  en: 'aaaaaaaa-0000-0000-0000-00000000e001',
  bm: 'aaaaaaaa-0000-0000-0000-00000000b001',
  ff: 'aaaaaaaa-0000-0000-0000-00000000ff01',
  project: 'bbbbbbbb-0000-0000-0000-000000000001',
  protocol: 'cccccccc-0000-0000-0000-000000000001',
  theme: 'dddddddd-0000-0000-0000-000000000001',
  qaset: 'eeeeeeee-0000-0000-0000-000000000001',
  qaset2: 'eeeeeeee-0000-0000-0000-000000000002',
  answerFr: 'f0000000-0000-0000-0000-00000000a0f1',
  answerEn: 'f0000000-0000-0000-0000-00000000a0e1',
  answerBm: 'f0000000-0000-0000-0000-00000000a0b1',
  variantFr1: 'f0000000-0000-0000-0000-0000000001f1',
  variantFr2: 'f0000000-0000-0000-0000-0000000001f2',
  variantFr3: 'f0000000-0000-0000-0000-0000000001f3',
  variantEn1: 'f0000000-0000-0000-0000-0000000001e1',
  audioAnswerFr: '99999999-0000-0000-0000-0000000000a1',
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

const audio = (
  id: string,
  durationMs: number,
  state: string | null,
): Schemas['AudioSummaryResponse'] => ({
  audio_id: id,
  mime_type: 'audio/webm',
  duration_ms: durationMs,
  size_bytes: 12_000,
  checksum_sha256: '0'.repeat(64),
  audio_validation: state === null ? null : { state },
});

const link = (otherId: string, otherLanguageId: string): Schemas['TranslationResponse'] => ({
  link_id: `${otherId}-link`,
  other_id: otherId,
  other_language_id: otherLanguageId,
});

/** The API order puts English first, to prove the page leads with the base language. */
export const QASET: Schemas['QASetResponse'] = {
  id: IDS.qaset,
  theme_id: IDS.theme,
  categories: [
    { category_id: 'c1', name: 'Prévention' },
    { category_id: 'c2', name: 'Enfants de moins de 5 ans' },
  ],
  clinical_validation: { state: 'validated' },
  languages: [
    {
      language_id: IDS.en,
      variant_count: 1,
      answer: {
        id: IDS.answerEn,
        text: 'Sleep under an insecticide-treated net every night.',
        links: [link(IDS.answerFr, IDS.fr)],
        audio: null,
        translation_validation: { state: 'validated' },
      },
      variants: [
        {
          id: IDS.variantEn1,
          language_id: IDS.en,
          text: 'How can I avoid malaria?',
          links: [link(IDS.variantFr1, IDS.fr)],
          intents: [],
          audio: null,
          translation_validation: { state: 'rejected' },
        },
      ],
    },
    {
      language_id: IDS.fr,
      variant_count: 3,
      answer: {
        id: IDS.answerFr,
        text: 'Dormez chaque nuit sous une moustiquaire imprégnée d’insecticide.',
        links: [link(IDS.answerEn, IDS.en)],
        audio: audio(IDS.audioAnswerFr, 65_000, null),
        translation_validation: null,
      },
      variants: [
        {
          id: IDS.variantFr1,
          language_id: IDS.fr,
          text: 'Comment éviter le paludisme ?',
          links: [link(IDS.variantEn1, IDS.en)],
          intents: [
            { intent_id: 'i1', text: 'prévention_paludisme' },
            { intent_id: 'i2', text: 'moustiquaire' },
          ],
          audio: audio(IDS.audioVariantFr1, 3_000, 'validated'),
          translation_validation: null,
        },
        {
          id: IDS.variantFr2,
          language_id: IDS.fr,
          text: 'Faut-il dormir sous une moustiquaire ?',
          links: [],
          intents: [{ intent_id: 'i2', text: 'moustiquaire' }],
          audio: null,
          translation_validation: null,
        },
        {
          id: IDS.variantFr3,
          language_id: IDS.fr,
          text: 'Que faire contre les moustiques la nuit ?',
          links: [],
          intents: [],
          audio: audio(IDS.audioVariantFr3, 4_500, 'rejected'),
          translation_validation: null,
        },
      ],
    },
    {
      language_id: IDS.bm,
      variant_count: 0,
      answer: {
        id: IDS.answerBm,
        text: 'Su o su, i ka da sɔsɔ-finiw kɔrɔ.',
        links: [],
        audio: audio(IDS.audioAnswerBm, 70_000, 'validated'),
        translation_validation: null,
      },
      variants: [],
    },
  ],
};

export const QASETS: Schemas['QASetsResponse'] = {
  items: [
    {
      id: IDS.qaset,
      theme_id: IDS.theme,
      languages: [
        { language_id: IDS.fr, variant_count: 3 },
        { language_id: IDS.en, variant_count: 1 },
      ],
    },
    { id: IDS.qaset2, theme_id: IDS.theme, languages: [{ language_id: IDS.fr, variant_count: 1 }] },
  ],
};

/** The whole world as a `FakeApiPort` answer table; spread and override per test. */
export function world(): Record<string, unknown> {
  return {
    '/languages': LANGUAGES,
    '/projects': { items: [PROJECT] },
    [`/projects/${IDS.project}`]: PROJECT,
    [`/projects/${IDS.project}/protocols`]: { items: [PROTOCOL] },
    [`/protocols/${IDS.protocol}`]: PROTOCOL,
    [`/protocols/${IDS.protocol}/themes`]: { items: [THEME] },
    [`/themes/${IDS.theme}`]: THEME,
    [`/themes/${IDS.theme}/qasets`]: QASETS,
    [`/qasets/${IDS.qaset}`]: QASET,
  };
}

export const ME_AUTHOR: Schemas['MeResponse'] = {
  id: '11111111-0000-0000-0000-000000000001',
  email: 'author@example.org',
  display_name: 'Awa Traoré',
  permissions: ['author_qasets', 'manage_audio'],
};

export const ME_READER: Schemas['MeResponse'] = {
  ...ME_AUTHOR,
  email: 'reader@example.org',
  permissions: ['review_clinical'],
};
