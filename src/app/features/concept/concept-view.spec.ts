import { LanguageDirectory } from '../../core/catalog/catalog.model';
import { CONCEPT, IDS, LANGUAGES } from '../../core/catalog/testing/catalog-fixtures';
import { toConceptView } from './concept-view';

const directory = new LanguageDirectory(LANGUAGES.items);
const view = () => toConceptView(CONCEPT, directory, IDS.fr);
const section = (code: string) => view().sections.find((s) => s.language.code === code)!;

describe('toConceptView', () => {
  it('has one section per QASet, base language first, then in the engine’s order', () => {
    expect(view().sections.map((s) => [s.language.code, s.isBase, s.id])).toEqual([
      ['fr', true, IDS.qasetFr],
      ['en', false, IDS.qasetEn],
      ['bm', false, IDS.qasetBm],
    ]);
  });

  it('keeps the variants in creation order, as the engine sends them', () => {
    expect(section('fr').variants.map((v) => v.id)).toEqual([
      IDS.variantFr1,
      IDS.variantFr2,
      IDS.variantFr3,
    ]);
  });

  it('lists each item’s audios per voice, with their quality', () => {
    expect(section('fr').answer.audios).toEqual([
      {
        id: IDS.audioAnswerFr,
        voiceId: IDS.voiceAwa,
        voiceName: 'Awa',
        durationMs: 65_000,
        quality: 'pending',
      },
      {
        id: IDS.audioAnswerFrMoussa,
        voiceId: IDS.voiceMoussa,
        voiceName: 'Moussa',
        durationMs: 61_000,
        quality: 'validated',
      },
    ]);
    expect(section('fr').variants.map((v) => v.audios.map((a) => a.voiceName))).toEqual([
      ['Awa'],
      [],
      ['Moussa'],
    ]);
  });

  it('counts variants and the variants with any audio separately, per language', () => {
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

  it('puts the clinical state on the base QASet and a translation state on the others', () => {
    expect(section('fr')).toMatchObject({ clinical: 'validated', translation: null });
    expect(section('en')).toMatchObject({ clinical: null, translation: 'rejected' });
    expect(section('bm')).toMatchObject({ clinical: null, translation: 'pending' });
  });

  it('titles the concept with its first base-language question', () => {
    expect(view().title).toBe('Comment éviter le paludisme ?');
  });

  it('falls back to no title when the base language has no variant', () => {
    expect(toConceptView(CONCEPT, directory, IDS.bm).title).toBeNull();
  });

  it('carries the concept’s intents and categories', () => {
    expect(view().intents).toEqual([
      { id: 'i1', label: 'prévention_paludisme' },
      { id: 'i2', label: 'moustiquaire' },
    ]);
    expect(view().categories).toEqual([
      { id: 'c1', label: 'Prévention' },
      { id: 'c2', label: 'Enfants de moins de 5 ans' },
    ]);
  });
});
