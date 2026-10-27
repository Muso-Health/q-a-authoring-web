import { EmptyFileError } from '../spreadsheet/spreadsheet-import-port';
import { MissingLabelColumnError, UnknownColumnsError, termsFromTable } from './glossary-import';

const LANGUAGES = [
  { id: 'lang-bm', code: 'bm', name: 'Bambara' },
  { id: 'lang-fr', code: 'fr', name: 'Français' },
  { id: 'lang-ff', code: 'FF', name: 'Peul' },
];

describe('termsFromTable', () => {
  it('makes a term of each row: its label, its note, a form for each language cell filled', () => {
    const terms = termsFromTable(
      {
        headers: ['label', 'note', 'fr', 'bm', 'ff'],
        rows: [
          {
            label: 'Diarrhée',
            note: 'Chez l’enfant.',
            fr: 'diarrhée',
            bm: 'kɔnɔboli',
            ff: '',
          },
          { label: 'Fièvre', note: '', fr: '', bm: '', ff: 'fewre' },
        ],
      },
      LANGUAGES,
    );

    expect(terms).toEqual([
      {
        label: 'Diarrhée',
        note: 'Chez l’enfant.',
        forms: [
          { languageId: 'lang-fr', preferred: 'diarrhée' },
          { languageId: 'lang-bm', preferred: 'kɔnɔboli' },
        ],
      },
      { label: 'Fièvre', note: null, forms: [{ languageId: 'lang-ff', preferred: 'fewre' }] },
    ]);
  });

  it('needs no note column, nor any language column', () => {
    expect(termsFromTable({ headers: ['label'], rows: [{ label: 'Fièvre' }] }, LANGUAGES)).toEqual([
      { label: 'Fièvre', note: null, forms: [] },
    ]);
  });

  it('skips the rows without a label', () => {
    const terms = termsFromTable(
      {
        headers: ['label', 'fr'],
        rows: [
          { label: '', fr: 'orpheline' },
          { label: 'Fièvre', fr: 'fièvre' },
        ],
      },
      LANGUAGES,
    );

    expect(terms.map((term) => term.label)).toEqual(['Fièvre']);
  });

  it('says there is nothing to import when no row has a label', () => {
    expect(() =>
      termsFromTable({ headers: ['label', 'fr'], rows: [{ label: '', fr: 'x' }] }, LANGUAGES),
    ).toThrow(EmptyFileError);
  });

  it('refuses a table without a label column', () => {
    expect(() =>
      termsFromTable({ headers: ['note', 'fr'], rows: [{ note: 'n', fr: 'f' }] }, LANGUAGES),
    ).toThrow(MissingLabelColumnError);
  });

  it('refuses a column that is neither label, note nor a known language code, naming each', () => {
    let error: unknown;
    try {
      termsFromTable(
        {
          headers: ['label', 'fr', 'xx', 'remarque'],
          rows: [{ label: 'Fièvre', fr: 'fièvre', xx: '', remarque: '' }],
        },
        LANGUAGES,
      );
    } catch (thrown) {
      error = thrown;
    }

    expect(error).toBeInstanceOf(UnknownColumnsError);
    expect((error as UnknownColumnsError).headers).toEqual(['xx', 'remarque']);
  });
});
