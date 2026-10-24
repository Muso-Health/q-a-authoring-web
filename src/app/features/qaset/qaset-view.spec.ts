import { LanguageDirectory } from '../../core/catalog/catalog.model';
import { IDS, LANGUAGES, QASET } from '../../core/catalog/testing/catalog-fixtures';
import { linkCandidates, toQASetView } from './qaset-view';

const directory = new LanguageDirectory(
  LANGUAGES.items.map(({ id, code, name }) => ({ id, code, name })),
);
const view = () => toQASetView(QASET, directory, IDS.fr);
const section = (code: string) => view().sections.find((s) => s.language.code === code)!;

describe('toQASetView', () => {
  it('groups by language, base language first, then in the engine’s order', () => {
    expect(view().sections.map((s) => [s.language.code, s.isBase])).toEqual([
      ['fr', true],
      ['en', false],
      ['bm', false],
    ]);
  });

  it('keeps the variants in creation order, as the engine sends them', () => {
    expect(section('fr').variants.map((v) => v.id)).toEqual([
      IDS.variantFr1,
      IDS.variantFr2,
      IDS.variantFr3,
    ]);
  });

  it('counts variants and the variants with audio separately, per language', () => {
    expect(section('fr').counts).toEqual({
      variants: 3,
      variantsWithAudio: 2,
      answerHasAudio: true,
    });
    expect(section('en').counts).toEqual({
      variants: 1,
      variantsWithAudio: 0,
      answerHasAudio: false,
    });
    expect(section('bm').counts).toEqual({
      variants: 0,
      variantsWithAudio: 0,
      answerHasAudio: true,
    });
  });

  it('titles the set with its first base-language question', () => {
    expect(view().title).toBe('Comment éviter le paludisme ?');
  });

  it('falls back to no title when the base language has no variant', () => {
    expect(toQASetView(QASET, directory, IDS.bm).title).toBeNull();
  });

  it('carries the clinical state and the categories', () => {
    expect(view().clinical).toBe('validated');
    expect(view().categories.map((c) => c.name)).toEqual([
      'Prévention',
      'Enfants de moins de 5 ans',
    ]);
  });

  it('applies translation validation only outside the base language, null meaning pending', () => {
    expect(section('fr').answer.translation).toBeNull();
    expect(section('fr').variants[0].translation).toBeNull();
    expect(section('en').answer.translation).toBe('validated');
    expect(section('en').variants[0].translation).toBe('rejected');
    expect(section('bm').answer.translation).toBe('pending');
  });

  it('maps audio with its quality state, null meaning pending', () => {
    expect(section('fr').answer.audio).toEqual({
      id: IDS.audioAnswerFr,
      durationMs: 65_000,
      quality: 'pending',
    });
    expect(section('fr').variants.map((v) => v.audio?.quality ?? null)).toEqual([
      'validated',
      null,
      'rejected',
    ]);
  });

  it('names the counterpart language of each translation link', () => {
    expect(section('fr').variants[0].links).toEqual([
      {
        linkId: `${IDS.variantEn1}-link`,
        otherId: IDS.variantEn1,
        language: { id: IDS.en, code: 'en', name: 'English' },
      },
    ]);
    expect(section('en').answer.links.map((l) => l.language.code)).toEqual(['fr']);
  });

  it('carries the intents of each variant', () => {
    expect(section('fr').variants[0].intents).toEqual([
      { id: 'i1', text: 'prévention_paludisme' },
      { id: 'i2', text: 'moustiquaire' },
    ]);
  });
});

describe('linkCandidates', () => {
  const ids = (role: 'answer' | 'variant', itemId: string) =>
    linkCandidates(view(), role, itemId).map((c) => c.id);

  it('offers an answer the other languages’ answers it is not yet linked to', () => {
    // French is already linked to English; Bambara is the only one left.
    expect(ids('answer', IDS.answerFr)).toEqual([IDS.answerBm]);
    expect(ids('answer', IDS.answerBm)).toEqual([IDS.answerFr, IDS.answerEn]);
  });

  it('offers a variant only variants, in other languages, not itself, not already linked', () => {
    expect(ids('variant', IDS.variantFr1)).toEqual([]);
    expect(ids('variant', IDS.variantFr2)).toEqual([IDS.variantEn1]);
    expect(ids('variant', IDS.variantEn1)).toEqual([IDS.variantFr2, IDS.variantFr3]);
  });

  it('describes each candidate by its text and its language', () => {
    expect(linkCandidates(view(), 'variant', IDS.variantFr2)).toEqual([
      {
        id: IDS.variantEn1,
        text: 'How can I avoid malaria?',
        language: { id: IDS.en, code: 'en', name: 'English' },
      },
    ]);
  });
});
