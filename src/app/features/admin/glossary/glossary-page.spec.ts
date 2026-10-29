import { TestBed } from '@angular/core/testing';
import { engineError } from '../../../core/api/testing/fake-api-port';
import {
  BEDNET_TERM,
  GLOSSARY,
  GLOSSARY_IDS,
  MALARIA_TERM,
  YELLOW_FEVER_TERM,
} from '../../../core/admin/testing/admin-fixtures';
import { IDS, LANGUAGES, ME_AUTHOR } from '../../../core/catalog/testing/catalog-fixtures';
import {
  EmptyFileError,
  SpreadsheetImportPort,
  UnreadableFileError,
  type ImportedTable,
} from '../../../core/spreadsheet/spreadsheet-import-port';
import {
  FakeSpreadsheetImportPort,
  namedFile,
} from '../../../core/spreadsheet/testing/fake-spreadsheet-import-port';
import { renderAdmin, text } from '../testing/render-admin';
import { GlossaryPage } from './glossary-page';

/** The engine's listing, as the page asks for it: twenty a page. */
const list = ({ status = 'active', q = '', offset = 0 } = {}) =>
  `/glossary/terms?status=${status}${q ? `&q=${q}` : ''}&limit=20&offset=${offset}`;

const TERM = (id: string) => `/glossary/terms/${id}`;

const MANAGER = { ...ME_AUTHOR, permissions: ['manage_glossary'] };
const READER = { ...ME_AUTHOR, permissions: ['manage_catalog'] };

async function render(answers: Record<string, unknown> = {}, me = MANAGER) {
  const sheets = new FakeSpreadsheetImportPort();
  TestBed.configureTestingModule({
    providers: [{ provide: SpreadsheetImportPort, useValue: sheets }],
  });
  const rendered = await renderAdmin(GlossaryPage, {
    '/me': me,
    '/languages': LANGUAGES,
    [list()]: GLOSSARY,
    ...answers,
  });
  const { element, fixture } = rendered;
  /** Chooses a file in the import picker, and waits for it to be read. */
  const upload = async (file: File) => {
    const picker = element.querySelector<HTMLInputElement>('.glossary-import input[type="file"]')!;
    Object.defineProperty(picker, 'files', { value: [file], configurable: true });
    picker.dispatchEvent(new Event('change'));
    await vi.waitFor(() => expect(picker.disabled).toBe(false));
    await fixture.whenStable();
  };
  return { ...rendered, sheets, upload };
}

const labels = (element: HTMLElement) =>
  [...element.querySelectorAll('li.glossary-term')].map((card) => text(card.querySelector('h3')));

const cardOf = (element: HTMLElement, label: string) =>
  [...element.querySelectorAll<HTMLElement>('li.glossary-term')].find(
    (card) => text(card.querySelector('h3')) === label,
  )!;

const formOf = (card: HTMLElement, language: string) =>
  [...card.querySelectorAll<HTMLElement>('li.glossary-form')].find(
    (form) => text(form.querySelector('.language')) === language,
  )!;

const chips = (scope: Element, kind: 'synonyms' | 'avoid') =>
  [...scope.querySelectorAll(`.${kind} li`)].map((chip) => text(chip));

const fieldValue = (form: Element | null, selector: string) =>
  form!.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)!.value;

describe('GlossaryPage — reading', () => {
  it('lists the active terms in the engine’s order, each with its forms by language', async () => {
    const { api, element } = await render();

    expect(text(element.querySelector('h2'))).toBe('Glossaire');
    expect(labels(element)).toEqual(['Moustiquaire', 'Paludisme']);
    expect(api.reads).toContain(list());

    const bednet = cardOf(element, 'Moustiquaire');
    const french = formOf(bednet, 'Français (fr)');
    expect(text(french.querySelector('.preferred'))).toBe('moustiquaire imprégnée');
    expect(chips(french, 'synonyms')).toEqual(['MII', 'moustiquaire traitée']);
    expect(chips(french, 'avoid')).toEqual(['filet']);
    expect(text(french)).toContain('Toujours préciser « imprégnée ».');

    const bambara = formOf(bednet, 'Bambara (bm)');
    expect(text(bambara.querySelector('.preferred'))).toBe('sanfɛsɛ');
    expect(bambara.querySelector('.synonyms')).toBeNull();
    expect(bambara.querySelector('.avoid')).toBeNull();

    expect(text(cardOf(element, 'Paludisme'))).toContain('Maladie transmise par les moustiques.');
    expect(text(element.querySelector('.count'))).toBe('2 termes');
  });

  it('says when a term has no form yet, and when the glossary is empty', async () => {
    const { element, choose } = await render({
      [list({ status: 'archived' })]: { items: [YELLOW_FEVER_TERM], total: 1 },
      [list({ status: 'all' })]: { items: [], total: 0 },
    });

    await choose('Statut', 'archived');
    expect(text(cardOf(element, 'Fièvre jaune'))).toContain('Aucune forme pour l’instant.');
    expect(text(element.querySelector('.count'))).toBe('1 terme');

    await choose('Statut', 'all');
    expect(text(element.querySelector('.muso-empty'))).toBe('Aucun terme ne correspond.');
  });

  it('says the glossary is empty when there is nothing at all to show', async () => {
    const { element } = await render({ [list()]: { items: [], total: 0 } });

    expect(text(element.querySelector('.muso-empty'))).toBe(
      'Le glossaire est vide pour l’instant.',
    );
    expect(element.querySelector('.count')).toBeNull();
  });

  it('filters by status: active by default, archived, or all, an archived term marked so', async () => {
    const { api, element, choose } = await render({
      [list({ status: 'archived' })]: { items: [YELLOW_FEVER_TERM], total: 1 },
      [list({ status: 'all' })]: {
        items: [YELLOW_FEVER_TERM, BEDNET_TERM, MALARIA_TERM],
        total: 3,
      },
    });
    const status = element.querySelector<HTMLSelectElement>('select#glossary-status')!;

    expect(status.value).toBe('active');
    expect([...status.options].map((o) => text(o))).toEqual(['Actifs', 'Archivés', 'Tous']);
    expect(element.querySelector('.archived-mark')).toBeNull();

    await choose('Statut', 'archived');
    expect(labels(element)).toEqual(['Fièvre jaune']);
    expect(text(cardOf(element, 'Fièvre jaune').querySelector('.archived-mark'))).toBe('Archivé');

    await choose('Statut', 'all');
    expect(labels(element)).toEqual(['Fièvre jaune', 'Moustiquaire', 'Paludisme']);
    expect(element.querySelectorAll('.archived-mark')).toHaveLength(1);

    expect(api.reads.filter((read) => read.startsWith('/glossary'))).toEqual([
      list(),
      list({ status: 'archived' }),
      list({ status: 'all' }),
    ]);
  });

  it('searches the labels and forms, and says when nothing matches', async () => {
    const { api, element, type } = await render({
      [list({ q: 'palu' })]: { items: [MALARIA_TERM], total: 1 },
      [list({ q: 'zz' })]: { items: [], total: 0 },
    });

    await type('Rechercher un terme ou une forme', '  palu ');
    expect(labels(element)).toEqual(['Paludisme']);

    await type('Rechercher un terme ou une forme', 'zz');
    expect(text(element.querySelector('.muso-empty'))).toBe('Aucun terme ne correspond.');

    await type('Rechercher un terme ou une forme', '');
    expect(labels(element)).toEqual(['Moustiquaire', 'Paludisme']);
    expect(api.reads.filter((read) => read.startsWith('/glossary'))).toEqual([
      list(),
      list({ q: 'palu' }),
      list({ q: 'zz' }),
      list(),
    ]);
  });

  it('pages through the terms twenty at a time, and a new search starts again on page 1', async () => {
    const { api, element, click, type, buttonNamed } = await render({
      [list()]: { items: [BEDNET_TERM], total: 45 },
      [list({ offset: 20 })]: { items: [MALARIA_TERM], total: 45 },
      [list({ offset: 40 })]: { items: [YELLOW_FEVER_TERM], total: 45 },
      [list({ q: 'mous' })]: { items: [BEDNET_TERM], total: 1 },
    });
    const pager = () => element.querySelector('nav.pager');

    expect(text(element.querySelector('.count'))).toBe('45 termes, page 1 sur 3');
    expect(pager()?.getAttribute('aria-label')).toBe('Pages du glossaire');
    expect(buttonNamed('Page précédente')!.disabled).toBe(true);

    await click('Page suivante');
    expect(labels(element)).toEqual(['Paludisme']);
    expect(text(element.querySelector('.count'))).toBe('45 termes, page 2 sur 3');

    await click('Page suivante');
    expect(text(element.querySelector('.count'))).toBe('45 termes, page 3 sur 3');
    expect(buttonNamed('Page suivante')!.disabled).toBe(true);

    await click('Page précédente');
    expect(labels(element)).toEqual(['Paludisme']);

    await type('Rechercher un terme ou une forme', 'mous');
    expect(text(element.querySelector('.count'))).toBe('1 terme');
    expect(pager()).toBeNull();
    expect(api.reads.filter((read) => read.startsWith('/glossary'))).toEqual([
      list(),
      list({ offset: 20 }),
      list({ offset: 40 }),
      list({ offset: 20 }),
      list({ q: 'mous' }),
    ]);
  });

  it('steps back to the last page when the one it was on has emptied', async () => {
    const { api, element, click } = await render({
      [list()]: { items: [BEDNET_TERM], total: 21 },
      [list({ offset: 20 })]: { items: [MALARIA_TERM], total: 21 },
    });

    await click('Page suivante');
    api.answers[list({ offset: 20 })] = { items: [], total: 20 };
    api.answers[list()] = { items: [BEDNET_TERM], total: 20 };
    await click('Archiver le terme Paludisme', cardOf(element, 'Paludisme'));

    expect(labels(element)).toEqual(['Moustiquaire']);
    expect(text(element.querySelector('.count'))).toBe('20 termes');
    expect(api.reads.slice(-2)).toEqual([list({ offset: 20 }), list()]);
  });
});

describe('GlossaryPage — terms', () => {
  it('creates a term with an optional note, then re-reads the page as it was', async () => {
    const { api, element, type, submit } = await render({
      [list({ q: 'mous' })]: { items: [BEDNET_TERM], total: 1 },
    });
    const form = element.querySelector('form.create');

    await type('Rechercher un terme ou une forme', 'mous');
    await type('Libellé', '  Fièvre ', form);
    await submit(form);
    await type('Libellé', 'Diarrhée', form);
    await type('Note', '  Chez l’enfant de moins de cinq ans. ', form);
    await submit(form);

    expect(api.writes).toEqual([
      { method: 'POST', path: '/glossary/terms', body: { label: 'Fièvre', note: null, forms: [] } },
      {
        method: 'POST',
        path: '/glossary/terms',
        body: { label: 'Diarrhée', note: 'Chez l’enfant de moins de cinq ans.', forms: [] },
      },
    ]);
    expect(api.reads.filter((read) => read.startsWith('/glossary')).slice(-2)).toEqual([
      list({ q: 'mous' }),
      list({ q: 'mous' }),
    ]);
    expect(fieldValue(form, 'input')).toBe('');
    expect(fieldValue(form, 'textarea')).toBe('');
  });

  it('asks for the label before creating, and shows the engine’s refusal', async () => {
    const { api, element, type, submit } = await render({
      'POST /glossary/terms': engineError(422, 'invalid_glossary_field', { field: 'label' }),
    });
    const form = element.querySelector('form.create');

    await type('Libellé', '   ', form);
    await submit(form);
    expect(api.writes).toEqual([]);
    expect(text(form?.querySelector('.field-error'))).toBe('Ce champ est obligatoire.');

    await type('Libellé', 'Fièvre', form);
    await submit(form);
    expect(text(form?.querySelector('[role="alert"]'))).toBe(
      'Le libellé et la forme préférée ne peuvent pas être vides.',
    );
  });

  it('edits a term’s label and note, clearing the note, then closes the editor', async () => {
    const { api, element, click, type, submit } = await render();
    const bednet = () => cardOf(element, 'Moustiquaire');

    await click('Modifier le terme Moustiquaire', bednet());
    const form = bednet().querySelector('form.term-edit');
    expect(fieldValue(form, 'input')).toBe('Moustiquaire');
    expect(fieldValue(form, 'textarea')).toBe('');
    await type('Libellé', 'Moustiquaires', form);
    await type('Note', 'Imprégnées', form);
    await submit(form);

    const malaria = () => cardOf(element, 'Paludisme');
    await click('Modifier le terme Paludisme', malaria());
    const second = malaria().querySelector('form.term-edit');
    expect(fieldValue(second, 'textarea')).toBe('Maladie transmise par les moustiques.');
    await type('Note', '  ', second);
    await submit(second);

    expect(api.writes).toEqual([
      {
        method: 'PATCH',
        path: TERM(GLOSSARY_IDS.bednet),
        body: { label: 'Moustiquaires', note: 'Imprégnées' },
      },
      {
        method: 'PATCH',
        path: TERM(GLOSSARY_IDS.malaria),
        body: { label: 'Paludisme', note: null },
      },
    ]);
    expect(element.querySelector('form.term-edit')).toBeNull();
  });

  it('cancels an edit without writing, the focus back on its button', async () => {
    const { api, element, click } = await render();
    const bednet = () => cardOf(element, 'Moustiquaire');

    await click('Modifier le terme Moustiquaire', bednet());
    await click('Annuler', bednet());

    expect(api.writes).toEqual([]);
    expect(bednet().querySelector('form')).toBeNull();
    expect(document.activeElement?.getAttribute('aria-label')).toBe(
      'Modifier le terme Moustiquaire',
    );
  });

  it('archives an active term, which leaves the active list on the re-read', async () => {
    const { api, element, click } = await render();

    api.answers[list()] = { items: [MALARIA_TERM], total: 1 };
    await click('Archiver le terme Moustiquaire', cardOf(element, 'Moustiquaire'));

    expect(api.writes).toEqual([
      { method: 'POST', path: `${TERM(GLOSSARY_IDS.bednet)}/archive`, body: null },
    ]);
    expect(labels(element)).toEqual(['Paludisme']);
  });

  it('unarchives an archived term', async () => {
    const { api, element, choose, click, buttonNamed } = await render({
      [list({ status: 'archived' })]: { items: [YELLOW_FEVER_TERM], total: 1 },
    });

    await choose('Statut', 'archived');
    const yellowFever = cardOf(element, 'Fièvre jaune');
    expect(buttonNamed('Archiver le terme Fièvre jaune', yellowFever)).toBeUndefined();
    await click('Désarchiver le terme Fièvre jaune', yellowFever);

    expect(api.writes).toEqual([
      { method: 'POST', path: `${TERM(GLOSSARY_IDS.yellowFever)}/unarchive`, body: null },
    ]);
  });

  it('tells when the term has gone meanwhile, and re-reads', async () => {
    const { api, element, click } = await render({
      [`POST ${TERM(GLOSSARY_IDS.bednet)}/archive`]: engineError(404, 'glossary_term_not_found'),
    });

    api.answers[list()] = { items: [MALARIA_TERM], total: 1 };
    await click('Archiver le terme Moustiquaire', cardOf(element, 'Moustiquaire'));

    expect(text(element.querySelector('.page-notice'))).toBe(
      'Ce terme n’existe plus : la page a été actualisée.',
    );
    expect(labels(element)).toEqual(['Paludisme']);
  });
});

describe('GlossaryPage — forms by language', () => {
  it('adds a form in a language the term lacks, synonyms and forms to avoid one per line', async () => {
    const { api, element, click, choose, type, submit } = await render();
    const malaria = () => cardOf(element, 'Paludisme');

    await click('Ajouter une forme au terme Paludisme', malaria());
    const form = malaria().querySelector('form.glossary-form-editor');
    expect([...form!.querySelectorAll('option')].map((o) => text(o))).toEqual([
      'Choisir une langue…',
      'Bambara (bm)',
      'English (en)',
      'Peul (ff)',
      'Wolof (wo)',
    ]);
    await choose('Langue', IDS.en, form);
    await type('Forme préférée', '  malaria ', form);
    await type('Synonymes', ' paludism \n\n  swamp fever \nmalaria fever', form);
    await type('À éviter', '   ', form);
    await submit(form);

    expect(api.writes).toEqual([
      {
        method: 'PUT',
        path: `${TERM(GLOSSARY_IDS.malaria)}/forms/${IDS.en}`,
        body: {
          preferred: 'malaria',
          synonyms: ['paludism', 'swamp fever', 'malaria fever'],
          avoid: [],
          note: null,
        },
      },
    ]);
    expect(malaria().querySelector('form')).toBeNull();
  });

  it('asks for a language and a preferred form before adding', async () => {
    const { api, element, click, submit } = await render();
    const malaria = () => cardOf(element, 'Paludisme');

    await click('Ajouter une forme au terme Paludisme', malaria());
    const form = malaria().querySelector('form.glossary-form-editor');
    await submit(form);

    expect(api.writes).toEqual([]);
    expect([...form!.querySelectorAll('.field-error')].map((e) => text(e))).toEqual([
      'Choisissez une langue.',
      'Ce champ est obligatoire.',
    ]);
  });

  it('offers no new form once the term has one in every language', async () => {
    const everywhere = {
      ...MALARIA_TERM,
      forms: LANGUAGES.items.map((language, i) => ({
        ...MALARIA_TERM.forms[0],
        id: `c5000000-0000-0000-0000-00000000000${i}`,
        language_id: language.id,
      })),
    };
    const { element, buttonNamed } = await render({ [list()]: { items: [everywhere], total: 1 } });

    expect(buttonNamed('Ajouter une forme au terme Paludisme', element)).toBeUndefined();
  });

  it('replaces a language’s form, its lists shown one per line, the language fixed', async () => {
    const { api, element, click, type, submit } = await render();
    const bednet = () => cardOf(element, 'Moustiquaire');

    await click('Modifier la forme en Français du terme Moustiquaire', bednet());
    const form = bednet().querySelector('form.glossary-form-editor');
    expect(form!.querySelector('select')).toBeNull();
    expect(text(form)).toContain('Français (fr)');
    expect(fieldValue(form, 'input')).toBe('moustiquaire imprégnée');
    const [synonyms, avoid, note] = [...form!.querySelectorAll('textarea')].map((t) => t.value);
    expect([synonyms, avoid, note]).toEqual([
      'MII\nmoustiquaire traitée',
      'filet',
      'Toujours préciser « imprégnée ».',
    ]);

    await type('À éviter', 'filet\nmoustiquaire simple', form);
    await type('Note', '', form);
    await submit(form);

    expect(api.writes).toEqual([
      {
        method: 'PUT',
        path: `${TERM(GLOSSARY_IDS.bednet)}/forms/${IDS.fr}`,
        body: {
          preferred: 'moustiquaire imprégnée',
          synonyms: ['MII', 'moustiquaire traitée'],
          avoid: ['filet', 'moustiquaire simple'],
          note: null,
        },
      },
    ]);
    expect(api.reads.filter((read) => read.startsWith('/glossary'))).toEqual([list(), list()]);
  });

  it('removes a language’s form after confirmation, then re-reads', async () => {
    const { api, element, click } = await render();
    const bambara = () => formOf(cardOf(element, 'Moustiquaire'), 'Bambara (bm)');

    await click('Retirer la forme en Bambara du terme Moustiquaire', bambara());
    expect(api.writes).toEqual([]);
    expect(text(bambara())).toContain('Retirer la forme en Bambara du terme « Moustiquaire » ?');
    await click('Confirmer', bambara());

    expect(api.writes).toEqual([
      { method: 'DELETE', path: `${TERM(GLOSSARY_IDS.bednet)}/forms/${IDS.bm}` },
    ]);
    expect(api.reads.filter((read) => read.startsWith('/glossary'))).toEqual([list(), list()]);
  });

  it('keeps a refusal on the form it concerns', async () => {
    const { element, click, submit } = await render({
      [`PUT ${TERM(GLOSSARY_IDS.bednet)}/forms/${IDS.fr}`]: engineError(
        422,
        'invalid_glossary_field',
        { field: 'preferred' },
      ),
    });
    const bednet = () => cardOf(element, 'Moustiquaire');

    await click('Modifier la forme en Français du terme Moustiquaire', bednet());
    await submit(bednet().querySelector('form.glossary-form-editor'));

    expect(text(bednet().querySelector('form [role="alert"]'))).toBe(
      'Le libellé et la forme préférée ne peuvent pas être vides.',
    );
    expect(cardOf(element, 'Paludisme').querySelector('[role="alert"]')).toBeNull();
  });
});

describe('GlossaryPage — without manage_glossary', () => {
  it('shows the whole glossary, forms included, with no way to change it', async () => {
    const { element, choose } = await render(
      { [list({ status: 'archived' })]: { items: [YELLOW_FEVER_TERM], total: 1 } },
      READER,
    );

    expect(labels(element)).toEqual(['Moustiquaire', 'Paludisme']);
    expect(chips(formOf(cardOf(element, 'Moustiquaire'), 'Français (fr)'), 'synonyms')).toEqual([
      'MII',
      'moustiquaire traitée',
    ]);
    expect(element.querySelector('form')).toBeNull();
    expect(text(element)).not.toContain('Ajouter un terme');
    const names = () =>
      [...element.querySelectorAll('li.glossary-term button')].map(
        (b) => b.getAttribute('aria-label') ?? text(b),
      );
    expect(names()).toEqual([]);

    await choose('Statut', 'archived');
    expect(names()).toEqual([]);
  });

  it('shows the engine’s refusal if the permission went while the page was open', async () => {
    const { api, element, click } = await render({
      [`POST ${TERM(GLOSSARY_IDS.bednet)}/archive`]: engineError(403, 'forbidden'),
    });

    await click('Archiver le terme Moustiquaire', cardOf(element, 'Moustiquaire'));

    expect(api.writes).toHaveLength(1);
    expect(text(cardOf(element, 'Moustiquaire').querySelector('[role="alert"]'))).toBe(
      'Votre compte n’a pas la permission de modifier ce contenu.',
    );
  });
});

/** Three rows to import: two terms, and a row without a label that is skipped. */
const SHEET: ImportedTable = {
  headers: ['label', 'note', 'fr', 'bm'],
  rows: [
    { label: 'Diarrhée', note: 'Chez l’enfant.', fr: 'diarrhée', bm: 'kɔnɔboli' },
    { label: 'Fièvre', note: '', fr: 'fièvre', bm: '' },
    { label: '', note: '', fr: 'orpheline', bm: '' },
  ],
};

const form = (languageId: string, preferred: string) => ({
  language_id: languageId,
  preferred,
  synonyms: [],
  avoid: [],
  note: null,
});

describe('GlossaryPage — importing', () => {
  const panel = (element: HTMLElement) => element.querySelector<HTMLElement>('.glossary-import')!;
  const reviewed = (element: HTMLElement) => [
    ...panel(element).querySelectorAll<HTMLElement>('li.import-term'),
  ];
  const status = (element: HTMLElement) => text(panel(element).querySelector('[role="status"]'));
  const alert = (element: HTMLElement) => text(panel(element).querySelector('[role="alert"]'));

  it('tells which columns to give, the language codes included', async () => {
    const { element } = await render();

    expect(text(panel(element).querySelector('h3'))).toBe('Importer des termes');
    expect(text(panel(element))).toContain(
      'une colonne par langue, nommée par son code (bm, en, fr, ff, wo)',
    );
  });

  it('reads a spreadsheet into a list to review, creating nothing yet', async () => {
    const { api, element, sheets, upload, buttonNamed } = await render();
    sheets.tables['termes.xlsx'] = SHEET;

    await upload(namedFile('termes.xlsx'));

    expect(api.writes).toEqual([]);
    expect(status(element)).toBe('2 termes lus dans « termes.xlsx », à relire avant de les créer.');
    const [diarrhoea, fever] = reviewed(element);
    expect(reviewed(element).map((item) => text(item.querySelector('.label')))).toEqual([
      'Diarrhée',
      'Fièvre',
    ]);
    expect(text(diarrhoea)).toContain('Chez l’enfant.');
    expect([...diarrhoea.querySelectorAll('.forms li')].map((li) => text(li))).toEqual([
      'Français (fr) : diarrhée',
      'Bambara (bm) : kɔnɔboli',
    ]);
    expect([...fever.querySelectorAll('.forms li')].map((li) => text(li))).toEqual([
      'Français (fr) : fièvre',
    ]);
    expect(buttonNamed('Créer les 2 termes', panel(element))).toBeDefined();
  });

  it('creates one term per row on confirmation, then says how many and re-reads', async () => {
    const { api, element, sheets, upload, click } = await render();
    sheets.tables['termes.xlsx'] = SHEET;
    await upload(namedFile('termes.xlsx'));
    const readsBefore = api.reads.filter((read) => read === list()).length;

    await click('Créer les 2 termes', panel(element));

    expect(api.writes).toEqual([
      {
        method: 'POST',
        path: '/glossary/terms',
        body: {
          label: 'Diarrhée',
          note: 'Chez l’enfant.',
          forms: [form(IDS.fr, 'diarrhée'), form(IDS.bm, 'kɔnɔboli')],
        },
      },
      {
        method: 'POST',
        path: '/glossary/terms',
        body: { label: 'Fièvre', note: null, forms: [form(IDS.fr, 'fièvre')] },
      },
    ]);
    expect(status(element)).toBe('2 termes créés.');
    expect(panel(element).querySelector('[role="alert"]')).toBeNull();
    expect(reviewed(element)).toEqual([]);
    expect(api.reads.filter((read) => read === list()).length).toBe(readsBefore + 1);
  });

  it('names the terms the engine refused, by their place in the list, and creates the rest', async () => {
    const { api, element, sheets, upload, click } = await render({
      'POST /glossary/terms': (body: { label: string }) =>
        body.label === 'Fièvre' ? engineError(422, 'invalid_glossary_field') : undefined,
    });
    sheets.tables['termes.csv'] = {
      headers: ['label'],
      rows: [{ label: 'Diarrhée' }, { label: 'Fièvre' }, { label: 'Toux' }],
    };
    await upload(namedFile('termes.csv'));

    await click('Créer les 3 termes', panel(element));

    expect(api.writes.map((write) => (write.body as { label: string }).label)).toEqual([
      'Diarrhée',
      'Fièvre',
      'Toux',
    ]);
    expect(status(element)).toBe('2 termes créés.');
    const refused = panel(element).querySelector('[role="alert"]')!;
    expect(text(refused.querySelector('p'))).toBe('1 terme non créé :');
    expect([...refused.querySelectorAll('li')].map((li) => text(li))).toEqual([
      'Ligne 2 de la liste, « Fièvre » : Le libellé et la forme préférée ne peuvent pas être vides.',
    ]);
  });

  it('drops the list on cancel, creating nothing', async () => {
    const { api, element, sheets, upload, click } = await render();
    sheets.tables['termes.xlsx'] = SHEET;
    await upload(namedFile('termes.xlsx'));

    await click('Annuler', panel(element));

    expect(reviewed(element)).toEqual([]);
    expect(api.writes).toEqual([]);
  });

  it('loads nothing from a file it cannot make terms of, and says why', async () => {
    const { api, element, sheets, upload } = await render();
    sheets.tables['termes.xlsx'] = SHEET;
    sheets.tables['notes.xlsx'] = { headers: ['note', 'fr'], rows: [{ note: 'n', fr: 'f' }] };
    sheets.tables['langues.xlsx'] = {
      headers: ['label', 'xx', 'remarque'],
      rows: [{ label: 'Fièvre', xx: '', remarque: '' }],
    };
    sheets.tables['vide.csv'] = new EmptyFileError();
    sheets.tables['casse.xlsx'] = new UnreadableFileError();

    await upload(namedFile('termes.xlsx'));
    await upload(namedFile('notes.xlsx'));
    expect(reviewed(element)).toEqual([]);
    expect(alert(element)).toBe(
      '« notes.xlsx » n’a pas de colonne « label » : la première ligne doit la nommer. Rien n’a été chargé.',
    );

    await upload(namedFile('langues.xlsx'));
    expect(alert(element)).toBe(
      'Colonnes inconnues dans « langues.xlsx » : xx et remarque. Hors « label » et « note », chaque colonne porte le code d’une langue : bm, en, fr, ff, wo. Rien n’a été chargé.',
    );

    await upload(namedFile('vide.csv'));
    expect(alert(element)).toBe(
      '« vide.csv » ne contient aucun terme : sous la ligne d’en-têtes, chaque ligne donne au moins un libellé. Rien n’a été chargé.',
    );

    await upload(namedFile('casse.xlsx'));
    expect(alert(element)).toBe(
      '« casse.xlsx » n’a pas pu être lu : choisissez un fichier .xlsx ou .csv valide. Rien n’a été chargé.',
    );
    expect(reviewed(element)).toEqual([]);
    expect(api.writes).toEqual([]);
  });

  it('is not offered without manage_glossary', async () => {
    const { element } = await render({}, READER);

    expect(element.querySelector('.glossary-import')).toBeNull();
    expect(element.querySelector('input[type="file"]')).toBeNull();
  });
});
