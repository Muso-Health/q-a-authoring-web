import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import type { Schemas } from '../../core/api/api-types';
import { ApiPort } from '../../core/api/api-port';
import { FakeApiPort, engineError } from '../../core/api/testing/fake-api-port';
import { IDS, ME_AUTHOR, ME_READER, world } from '../../core/catalog/testing/catalog-fixtures';
import { provideTestI18n } from '../../core/i18n/testing/provide-test-i18n';
import {
  EmptyFileError,
  MissingColumnError,
  SpreadsheetImportPort,
  UnreadableFileError,
} from '../../core/spreadsheet/spreadsheet-import-port';
import {
  FakeSpreadsheetImportPort,
  namedFile,
} from '../../core/spreadsheet/testing/fake-spreadsheet-import-port';
import { ThemePage } from './theme-page';

const PAIRS = `POST /themes/${IDS.theme}/qa-pairs`;
const CONCEPTS = `/themes/${IDS.theme}/concepts`;
const AUTHORED: Schemas['AuthoredPairsResponse'] = {
  concepts_created: 1,
  concepts_updated: 0,
  variants_added: 2,
  skipped_rows: [],
};

const text = (element: Element | null | undefined) =>
  element?.textContent?.replace(/\s+/g, ' ').trim();

async function render(me: Schemas['MeResponse'] = ME_AUTHOR) {
  const api = new FakeApiPort({ ...world(), '/me': me, [PAIRS]: AUTHORED });
  const sheets = new FakeSpreadsheetImportPort();
  TestBed.configureTestingModule({
    imports: [ThemePage],
    providers: [
      provideTestI18n(),
      provideRouter([]),
      { provide: ApiPort, useValue: api },
      { provide: SpreadsheetImportPort, useValue: sheets },
    ],
  });
  const fixture = TestBed.createComponent(ThemePage);
  fixture.componentRef.setInput('themeId', IDS.theme);
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;

  const rows = () => [...element.querySelectorAll<HTMLFieldSetElement>('fieldset.pair')];
  const button = (name: string) =>
    [...element.querySelectorAll('button')].find(
      (b) => text(b) === name || b.getAttribute('aria-label') === name,
    );
  const click = async (name: string) => {
    button(name)!.click();
    await fixture.whenStable();
  };
  const type = async (row: number, field: 'question' | 'answer', value: string) => {
    const control = rows()[row].querySelector<HTMLInputElement | HTMLTextAreaElement>(
      field === 'question' ? 'input' : 'textarea',
    )!;
    control.value = value;
    control.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  };
  /** Fills the form with these pairs, adding rows as needed. */
  const fill = async (...pairs: [string, string][]) => {
    for (const [index, [question, answer]] of pairs.entries()) {
      if (index >= rows().length) await click('Ajouter une paire');
      await type(index, 'question', question);
      await type(index, 'answer', answer);
    }
  };
  const submit = async () => {
    element.querySelector<HTMLFormElement>('form.pairs')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
  };
  /** Chooses a file in the import picker, and waits for it to be read. */
  const upload = async (file: File) => {
    const picker = element.querySelector<HTMLInputElement>('form.pairs input[type="file"]')!;
    Object.defineProperty(picker, 'files', { value: [file], configurable: true });
    picker.dispatchEvent(new Event('change'));
    await vi.waitFor(() => expect(picker.disabled).toBe(false));
    await fixture.whenStable();
  };
  const values = () =>
    rows().map((row) => [row.querySelector('input')!.value, row.querySelector('textarea')!.value]);
  const router = TestBed.inject(Router);
  const settle = () => fixture.whenStable();
  return {
    api,
    sheets,
    element,
    rows,
    button,
    click,
    type,
    fill,
    submit,
    upload,
    values,
    router,
    settle,
  };
}

describe('ThemePage authoring', () => {
  describe('a new concept', () => {
    const CREATE = `POST /themes/${IDS.theme}/concepts`;

    it('is offered only with author_qasets', async () => {
      const reader = await render(ME_READER);

      expect(reader.button('Nouvelle notion')).toBeUndefined();
    });

    it('starts in the base language with its answer, then opens the new concept', async () => {
      const { api, element, click, router, settle } = await render();
      const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
      api.answers[CREATE] = { id: 'new-concept' };

      await click('Nouvelle notion');
      const form = element.querySelector<HTMLFormElement>('.new-concept form')!;
      expect(text(form.querySelector('label'))).toBe('Réponse (Français)');
      const answer = form.querySelector('textarea')!;
      answer.value = ' Lavez-vous les mains. ';
      answer.dispatchEvent(new Event('input'));
      form.dispatchEvent(new Event('submit'));
      await settle();

      expect(api.writes).toEqual([
        {
          method: 'POST',
          path: `/themes/${IDS.theme}/concepts`,
          body: { language_id: IDS.fr, answer_text: 'Lavez-vous les mains.' },
        },
      ]);
      expect(navigate).toHaveBeenCalledWith(['/concepts', 'new-concept']);
    });

    it('keeps the form and says so when the theme already has that answer', async () => {
      const { api, element, click, settle } = await render();
      api.answers[CREATE] = engineError(409, 'answer_already_exists', { concept_id: IDS.concept });

      await click('Nouvelle notion');
      const form = element.querySelector<HTMLFormElement>('.new-concept form')!;
      const answer = form.querySelector('textarea')!;
      answer.value = 'Dormez chaque nuit sous une moustiquaire imprégnée d’insecticide.';
      answer.dispatchEvent(new Event('input'));
      form.dispatchEvent(new Event('submit'));
      await settle();

      expect(text(element.querySelector('.new-concept [role="alert"]'))).toBe(
        'Ce thème a déjà une notion avec cette réponse.',
      );
    });
  });

  it('offers pair authoring only with author_qasets', async () => {
    const reader = await render(ME_READER);

    expect(reader.element.querySelector('form.pairs')).toBeNull();
  });

  it('starts with one empty pair, a question and its answer, and no language to choose', async () => {
    const { element, rows } = await render();

    expect(rows()).toHaveLength(1);
    const labels = [...rows()[0].querySelectorAll('label')].map((label) => text(label));
    expect(labels).toEqual(['Question', 'Réponse']);
    expect(element.querySelector('form.pairs select')).toBeNull();
    // Written in the project's base language, and the page says which.
    expect(text(element.querySelector('form.pairs'))).toContain('Français');
  });

  describe('rows', () => {
    it('adds an empty row with “+”, and moves the focus into it', async () => {
      const { rows, click, type } = await render();
      await type(0, 'question', 'Q1');

      await click('Ajouter une paire');

      expect(rows()).toHaveLength(2);
      expect(rows()[1].querySelector('input')!.value).toBe('');
      expect(document.activeElement).toBe(rows()[1].querySelector('input'));
    });

    it('names each row, and lets every row but the first be removed', async () => {
      const { rows, button, click } = await render();
      await click('Ajouter une paire');
      await click('Ajouter une paire');

      expect(rows().map((row) => text(row.querySelector('legend')))).toEqual([
        'Paire 1',
        'Paire 2',
        'Paire 3',
      ]);
      expect(button('Retirer la paire 1')).toBeUndefined();
      expect(button('Retirer la paire 2')).toBeDefined();
      expect(button('Retirer la paire 3')).toBeDefined();
    });

    it('removes the chosen row and keeps what the others hold', async () => {
      const { rows, click, fill, values } = await render();
      await fill(['Q1', 'R1'], ['Q2', 'R2'], ['Q3', 'R3']);

      await click('Retirer la paire 2');

      expect(values()).toEqual([
        ['Q1', 'R1'],
        ['Q3', 'R3'],
      ]);
      expect(document.activeElement).toBe(rows()[0].querySelector('input'));
    });

    it('always keeps at least one row', async () => {
      const { rows, button, click } = await render();
      await click('Ajouter une paire');

      await click('Retirer la paire 2');

      expect(rows()).toHaveLength(1);
      expect(button('Retirer la paire 1')).toBeUndefined();
    });
  });

  describe('submitting', () => {
    it('sends a trimmed array of question and answer, with no language field', async () => {
      const { api, fill, submit } = await render();
      await fill(['  Comment se protéger ?  ', ' Dormez sous une moustiquaire. '], ['Q2', 'R2']);

      await submit();

      expect(api.writes).toEqual([
        {
          method: 'POST',
          path: `/themes/${IDS.theme}/qa-pairs`,
          body: [
            { question: 'Comment se protéger ?', answer: 'Dormez sous une moustiquaire.' },
            { question: 'Q2', answer: 'R2' },
          ],
        },
      ]);
    });

    it('drops the rows left entirely blank', async () => {
      const { api, fill, submit } = await render();
      await fill(['Q1', 'R1'], ['   ', ''], ['Q3', 'R3'], ['', '  ']);

      await submit();

      expect(api.writes[0].body).toEqual([
        { question: 'Q1', answer: 'R1' },
        { question: 'Q3', answer: 'R3' },
      ]);
    });

    it('blocks a half-filled row, inline, and sends nothing', async () => {
      const { api, element, rows, fill, submit } = await render();
      await fill(['Q1', 'R1'], ['Q2 sans réponse', '  '], ['', 'R3 sans question']);

      await submit();

      expect(api.writes).toEqual([]);
      expect(text(element.querySelector('form.pairs [role="alert"]'))).toBe(
        'Chaque paire demande une question et une réponse : complétez ou videz les paires signalées.',
      );
      expect(rows().map((row) => row.classList.contains('invalid'))).toEqual([false, true, true]);
      expect(rows()[1].querySelector('textarea')!.getAttribute('aria-invalid')).toBe('true');
      expect(rows()[1].querySelector('input')!.getAttribute('aria-invalid')).toBeNull();
      expect(rows()[2].querySelector('input')!.getAttribute('aria-invalid')).toBe('true');
    });

    it('asks for one pair when every row is blank', async () => {
      const { api, element, submit } = await render();

      await submit();

      expect(api.writes).toEqual([]);
      expect(text(element.querySelector('form.pairs [role="alert"]'))).toBe(
        'Saisissez au moins une paire.',
      );
    });

    it('shows the summary, resets to one empty row and re-reads the theme’s QA sets', async () => {
      const { api, element, rows, fill, submit, values } = await render();
      api.answers[PAIRS] = {
        concepts_created: 2,
        concepts_updated: 1,
        variants_added: 3,
        // Sent: Q1, Q2, Q3, Q1 — the repeated Q1 is the batch's index 3, the form's row 5.
        skipped_rows: [3],
      } satisfies Schemas['AuthoredPairsResponse'];
      await fill(['Q1', 'R1'], ['', ''], ['Q2', 'R2'], ['Q3', 'R3'], ['Q1', 'R1']);
      const reads = api.reads.filter((path) => path === CONCEPTS).length;
      api.answers[CONCEPTS] = { items: [] };

      await submit();

      const summary = element.querySelector('.summary[role="status"]');
      expect(text(summary)).toContain(
        'Paires enregistrées : 2 notions créées, 1 notion complétée, 3 questions ajoutées.',
      );
      // The skipped index is the engine's (in what was sent); the reader sees their own row.
      expect(text(summary)).toContain('Déjà présente, donc ignorée : paire 5.');
      expect(rows()).toHaveLength(1);
      expect(values()).toEqual([['', '']]);
      expect(api.reads.filter((path) => path === CONCEPTS).length).toBe(reads + 1);
      expect(element.textContent).toContain('Aucune notion dans ce thème.');
    });

    it('lists several skipped rows together', async () => {
      const { api, element, fill, submit } = await render();
      api.answers[PAIRS] = { ...AUTHORED, skipped_rows: [1, 2] };
      await fill(['Q1', 'R1'], ['Q1', 'R1'], ['Q1', 'R1']);

      await submit();

      expect(text(element.querySelector('.summary'))).toContain(
        'Déjà présentes, donc ignorées : paires 2 et 3.',
      );
    });

    it('says nothing was skipped by saying nothing about it', async () => {
      const { element, fill, submit } = await render();
      await fill(['Q1', 'R1']);

      await submit();

      expect(text(element.querySelector('.summary'))).toBe(
        'Paires enregistrées : 1 notion créée, 0 notion complétée, 2 questions ajoutées.',
      );
    });
  });

  describe('refusals', () => {
    it('highlights the rows the engine refused (invalid_qa_pairs), as the reader numbers them', async () => {
      const { api, element, rows, fill, submit, values } = await render();
      api.answers[PAIRS] = engineError(422, 'invalid_qa_pairs', { rows: [1] });
      await fill(['Q1', 'R1'], ['', ''], ['Q3', 'R3']);

      await submit();

      expect(rows().map((row) => row.classList.contains('invalid'))).toEqual([false, false, true]);
      expect(rows()[2].querySelector('input')!.getAttribute('aria-invalid')).toBe('true');
      expect(text(element.querySelector('form.pairs [role="alert"]'))).toBe(
        'Le moteur a refusé les paires signalées : chacune demande une question et une réponse. Rien n’a été enregistré.',
      );
      // Nothing was written: the author's rows stay, to be fixed.
      expect(values()).toHaveLength(3);
    });

    it('explains a refused batch (invalid_request): too many pairs or a malformed body', async () => {
      const { api, element, fill, submit } = await render();
      api.answers[PAIRS] = engineError(422, 'invalid_request');
      await fill(['Q1', 'R1']);

      await submit();

      expect(text(element.querySelector('form.pairs [role="alert"]'))).toBe(
        'L’envoi a été refusé : 500 paires au plus, chacune avec une question et une réponse. Rien n’a été enregistré.',
      );
    });

    it('says when the author may not write here (403)', async () => {
      const { api, element, fill, submit } = await render();
      api.answers[PAIRS] = engineError(403, 'permission_denied');
      await fill(['Q1', 'R1']);

      await submit();

      expect(text(element.querySelector('form.pairs [role="alert"]'))).toBe(
        'Votre compte n’a pas la permission de modifier ce contenu.',
      );
    });

    it('re-reads the page when the theme is gone (404)', async () => {
      const { api, element, fill, submit } = await render();
      api.answers[PAIRS] = engineError(404, 'theme_not_found');
      await fill(['Q1', 'R1']);
      const reads = api.reads.length;

      await submit();

      expect(text(element.querySelector('form.pairs [role="alert"]'))).toBe(
        'Cet élément n’existe plus : la page a été actualisée.',
      );
      expect(api.reads.length).toBeGreaterThan(reads);
    });
  });

  describe('importing a spreadsheet', () => {
    /** As the port gives them: trimmed, blank rows already left out. */
    const PAIRS_READ = [
      { question: 'Comment se protéger ?', answer: 'Dormez sous une moustiquaire.' },
      { question: 'Qui est concerné ?', answer: 'Les enfants de moins de cinq ans.' },
    ];

    it('offers an Excel or CSV file, with its expected columns', async () => {
      const { element, button } = await render();

      const picker = element.querySelector<HTMLInputElement>('form.pairs input[type="file"]')!;
      expect(picker.accept).toContain('.xlsx');
      expect(picker.accept).toContain('.csv');
      expect(button('Importer un fichier Excel ou CSV')).toBeDefined();
      expect(text(element.querySelector('.import .muso-meta'))).toContain('« question »');
    });

    it('hands the chosen file to the import port', async () => {
      const { sheets, upload } = await render();
      const file = namedFile('paires.xlsx');
      sheets.answers['paires.xlsx'] = PAIRS_READ;

      await upload(file);

      expect(sheets.files).toEqual([file]);
    });

    it('replaces the empty starter row with the file’s pairs, and sends nothing', async () => {
      const { api, sheets, element, upload, values } = await render();
      sheets.answers['paires.xlsx'] = PAIRS_READ;

      await upload(namedFile('paires.xlsx'));

      expect(values()).toEqual([
        ['Comment se protéger ?', 'Dormez sous une moustiquaire.'],
        ['Qui est concerné ?', 'Les enfants de moins de cinq ans.'],
      ]);
      expect(text(element.querySelector('.import [role="status"]'))).toBe(
        '2 paires chargées depuis « paires.xlsx » : relisez-les, puis enregistrez.',
      );
      // Loaded for review: nothing is sent until the author submits.
      expect(api.writes).toEqual([]);
    });

    it('appends after the rows the author already has', async () => {
      const { sheets, fill, upload, values } = await render();
      sheets.answers['plus.csv'] = [{ question: 'Q2', answer: 'R2' }];
      await fill(['Q1', 'R1']);

      await upload(namedFile('plus.csv'));

      expect(values()).toEqual([
        ['Q1', 'R1'],
        ['Q2', 'R2'],
      ]);
    });

    it('appends after a row with only one half too: only the untouched starter is replaced', async () => {
      const { sheets, fill, upload, values } = await render();
      sheets.answers['plus.csv'] = [{ question: 'Q2', answer: 'R2' }];
      await fill(['', 'Une réponse en cours']);

      await upload(namedFile('plus.csv'));

      expect(values()).toEqual([
        ['', 'Une réponse en cours'],
        ['Q2', 'R2'],
      ]);
    });

    it('lets the imported rows be edited and removed like any other', async () => {
      const { sheets, click, type, upload, values } = await render();
      sheets.answers['paires.xlsx'] = PAIRS_READ;
      await upload(namedFile('paires.xlsx'));

      await type(0, 'question', 'Comment éviter le paludisme ?');
      await click('Retirer la paire 2');
      await click('Ajouter une paire');

      expect(values()).toEqual([
        ['Comment éviter le paludisme ?', 'Dormez sous une moustiquaire.'],
        ['', ''],
      ]);
    });

    it('submits imported rows by the same path, as one batch', async () => {
      const { api, sheets, upload, submit } = await render();
      sheets.answers['paires.xlsx'] = PAIRS_READ;
      await upload(namedFile('paires.xlsx'));

      await submit();

      expect(api.writes).toEqual([
        { method: 'POST', path: `/themes/${IDS.theme}/qa-pairs`, body: PAIRS_READ },
      ]);
    });

    it('validates imported rows as typed ones: a half-filled row blocks the submit', async () => {
      const { api, sheets, rows, upload, submit } = await render();
      sheets.answers['paires.csv'] = [
        { question: 'Q1', answer: 'R1' },
        { question: 'Q2 sans réponse', answer: '' },
      ];
      await upload(namedFile('paires.csv'));

      await submit();

      expect(api.writes).toEqual([]);
      expect(rows().map((row) => row.classList.contains('invalid'))).toEqual([false, true]);
    });

    it('loads nothing when a column is missing, and says which', async () => {
      const { sheets, element, fill, upload, values } = await render();
      sheets.answers['liste.xlsx'] = new MissingColumnError(['answer']);
      await fill(['Q1', 'R1']);

      await upload(namedFile('liste.xlsx'));

      expect(values()).toEqual([['Q1', 'R1']]);
      expect(text(element.querySelector('.import [role="alert"]'))).toBe(
        'Colonne introuvable dans « liste.xlsx » : réponse. La première ligne doit nommer une colonne « question » et une colonne « réponse » (ou « answer »). Rien n’a été chargé.',
      );
      expect(element.querySelector('.import [role="status"]')?.textContent?.trim()).toBeFalsy();
    });

    it('names both columns when neither is there', async () => {
      const { sheets, element, upload } = await render();
      sheets.answers['liste.csv'] = new MissingColumnError(['question', 'answer']);

      await upload(namedFile('liste.csv'));

      expect(text(element.querySelector('.import [role="alert"]'))).toContain(
        'Colonnes introuvables dans « liste.csv » : question et réponse.',
      );
    });

    it('loads nothing from an empty file', async () => {
      const { sheets, element, upload, values } = await render();
      sheets.answers['vide.xlsx'] = new EmptyFileError();

      await upload(namedFile('vide.xlsx'));

      expect(values()).toEqual([['', '']]);
      expect(text(element.querySelector('.import [role="alert"]'))).toBe(
        '« vide.xlsx » ne contient aucune paire : sous la ligne d’en-têtes, chaque ligne donne une question et sa réponse. Rien n’a été chargé.',
      );
    });

    it('loads nothing from a file it cannot read', async () => {
      const { sheets, element, fill, upload, values } = await render();
      sheets.answers['abîmé.xlsx'] = new UnreadableFileError();
      await fill(['Q1', 'R1']);

      await upload(namedFile('abîmé.xlsx'));

      expect(values()).toEqual([['Q1', 'R1']]);
      expect(text(element.querySelector('.import [role="alert"]'))).toBe(
        '« abîmé.xlsx » n’a pas pu être lu : choisissez un fichier .xlsx ou .csv valide. Rien n’a été chargé.',
      );
    });

    it('treats any other failure as a file it could not read, and loads nothing', async () => {
      const { sheets, element, upload, values } = await render();
      sheets.answers['x.xlsx'] = new Error('chunk failed to load');
      const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      await upload(namedFile('x.xlsx'));

      expect(values()).toEqual([['', '']]);
      expect(text(element.querySelector('.import [role="alert"]'))).toContain('n’a pas pu être lu');
      expect(error).toHaveBeenCalled();
      error.mockRestore();
    });

    it('clears an import error once a good file loads', async () => {
      const { sheets, element, upload } = await render();
      sheets.answers['vide.xlsx'] = new EmptyFileError();
      sheets.answers['paires.xlsx'] = PAIRS_READ;
      await upload(namedFile('vide.xlsx'));

      await upload(namedFile('paires.xlsx'));

      expect(element.querySelector('.import [role="alert"]')).toBeNull();
    });
  });
});
