import { TestBed } from '@angular/core/testing';
import { provideSpreadsheetImport } from './provide-spreadsheet-import';
import { SheetJsSpreadsheetImportAdapter } from './sheetjs-spreadsheet-import-adapter';
import {
  EmptyFileError,
  MissingColumnError,
  SpreadsheetImportPort,
  UnreadableFileError,
} from './spreadsheet-import-port';
import { csvFile, xlsxFile } from './testing/spreadsheet-files';

function setUp(): SpreadsheetImportPort {
  TestBed.configureTestingModule({ providers: [provideSpreadsheetImport()] });
  return TestBed.inject(SpreadsheetImportPort);
}

describe('SheetJsSpreadsheetImportAdapter', () => {
  it('is what the port is bound to', () => {
    expect(setUp()).toBeInstanceOf(SheetJsSpreadsheetImportAdapter);
  });

  describe('headers', () => {
    it('finds question and réponse, whatever their case and spacing', async () => {
      const pairs = await setUp().parsePairs(
        xlsxFile([
          ['  QUESTION ', 'Réponse'],
          ['Comment se protéger ?', 'Dormez sous une moustiquaire.'],
        ]),
      );

      expect(pairs).toEqual([
        { question: 'Comment se protéger ?', answer: 'Dormez sous une moustiquaire.' },
      ]);
    });

    it('finds question and answer, or réponse with or without its accent', async () => {
      const port = setUp();
      for (const answer of ['Answer', 'réponse', 'RÉPONSE', 'Reponse']) {
        expect(
          await port.parsePairs(
            xlsxFile([
              ['Question', answer],
              ['Q', 'R'],
            ]),
          ),
        ).toEqual([{ question: 'Q', answer: 'R' }]);
      }
    });

    it('takes no Spanish header for a column', async () => {
      const error = await setUp()
        .parsePairs(
          xlsxFile([
            ['Pregunta', 'Respuesta'],
            ['Q', 'R'],
          ]),
        )
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(MissingColumnError);
      expect((error as MissingColumnError).columns).toEqual(['question', 'answer']);
    });

    it('reads the columns wherever they are, and ignores the others', async () => {
      const pairs = await setUp().parsePairs(
        xlsxFile([
          ['N°', 'Réponse', 'Remarque', 'Question'],
          [1, 'Dormez sous une moustiquaire.', 'à relire', 'Comment se protéger ?'],
        ]),
      );

      expect(pairs).toEqual([
        { question: 'Comment se protéger ?', answer: 'Dormez sous une moustiquaire.' },
      ]);
    });

    it('names the missing column, with the headers it would have accepted', async () => {
      const error = await setUp()
        .parsePairs(
          xlsxFile([
            ['Question', 'Commentaire'],
            ['Q', 'R'],
          ]),
        )
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(MissingColumnError);
      expect((error as MissingColumnError).columns).toEqual(['answer']);
      expect((error as MissingColumnError).accepted).toEqual({ answer: ['réponse', 'answer'] });
    });

    it('names both columns when neither is there', async () => {
      const error = await setUp()
        .parsePairs(
          xlsxFile([
            ['Intitulé', 'Texte'],
            ['Q', 'R'],
          ]),
        )
        .catch((e: unknown) => e);

      expect((error as MissingColumnError).columns).toEqual(['question', 'answer']);
    });
  });

  describe('rows', () => {
    it('trims both cells, keeps a row with only one half, and skips rows blank on both', async () => {
      const pairs = await setUp().parsePairs(
        xlsxFile([
          ['question', 'answer'],
          ['  Q1  ', ' R1 '],
          ['', '   '],
          [],
          ['Q2 sans réponse', null],
          [undefined, 'R3 sans question'],
          [42, 'R4'],
        ]),
      );

      // A half-filled row is the author's to fix: the form flags it on submit, as if typed.
      expect(pairs).toEqual([
        { question: 'Q1', answer: 'R1' },
        { question: 'Q2 sans réponse', answer: '' },
        { question: '', answer: 'R3 sans question' },
        { question: '42', answer: 'R4' },
      ]);
    });

    it('reads the first sheet only', async () => {
      const pairs = await setUp().parsePairs(
        xlsxFile(
          [
            ['Question', 'Réponse'],
            ['Comment se protéger ?', 'Dormez sous une moustiquaire.'],
            ['Qui est concerné ?', 'Les enfants de moins de cinq ans.'],
          ],
          'paires.xlsx',
          true,
        ),
      );

      expect(pairs).toEqual([
        { question: 'Comment se protéger ?', answer: 'Dormez sous une moustiquaire.' },
        { question: 'Qui est concerné ?', answer: 'Les enfants de moins de cinq ans.' },
      ]);
    });

    it('reads a UTF-8 CSV, accents intact, comma- or semicolon-separated', async () => {
      const port = setUp();
      const expected = [
        { question: 'Où dormir ?', answer: 'Sous la moustiquaire, été comme hiver.' },
      ];

      expect(
        await port.parsePairs(
          csvFile('Question,Réponse\nOù dormir ?,"Sous la moustiquaire, été comme hiver."\n'),
        ),
      ).toEqual(expected);
      expect(
        await port.parsePairs(
          csvFile('question;réponse\r\nOù dormir ?;Sous la moustiquaire, été comme hiver.\r\n'),
        ),
      ).toEqual(expected);
    });
  });

  describe('files that give no pair', () => {
    it('says a file with no data is empty: no bytes, headers only, or only blank rows', async () => {
      const port = setUp();

      await expect(port.parsePairs(new File([], 'vide.xlsx'))).rejects.toBeInstanceOf(
        EmptyFileError,
      );
      await expect(port.parsePairs(csvFile(''))).rejects.toBeInstanceOf(EmptyFileError);
      await expect(port.parsePairs(xlsxFile([['Question', 'Réponse']]))).rejects.toBeInstanceOf(
        EmptyFileError,
      );
      await expect(
        port.parsePairs(
          xlsxFile([
            ['Question', 'Réponse'],
            ['', ''],
            [' ', ' '],
          ]),
        ),
      ).rejects.toBeInstanceOf(EmptyFileError);
    });

    it('says a broken workbook cannot be read, without leaking the library’s error', async () => {
      const broken = new File(
        [new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3, 4, 5, 6])],
        'x.xlsx',
      );

      const error = await setUp()
        .parsePairs(broken)
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(UnreadableFileError);
      expect((error as UnreadableFileError).name).toBe('UnreadableFileError');
    });
  });

  describe('any table', () => {
    it('folds the headers and maps each row by them, every cell trimmed', async () => {
      const table = await setUp().parseTable(
        xlsxFile(
          [
            ['  Label ', 'NOTE', 'Libellé', 'Fr', 'BM'],
            ['  Paludisme ', '', ' palu ', 'paludisme', 42],
          ],
          'termes.xlsx',
        ),
      );

      expect(table).toEqual({
        headers: ['label', 'note', 'libelle', 'fr', 'bm'],
        rows: [{ label: 'Paludisme', note: '', libelle: 'palu', fr: 'paludisme', bm: '42' }],
      });
    });

    it('skips the rows blank in every cell, and the columns without a header', async () => {
      const table = await setUp().parseTable(
        xlsxFile([
          ['label', '', 'fr'],
          ['Fièvre', 'sans en-tête', ''],
          ['  ', 'sans en-tête', ' '],
          [],
          ['', '', 'diarrhée'],
        ]),
      );

      expect(table).toEqual({
        headers: ['label', 'fr'],
        rows: [
          { label: 'Fièvre', fr: '' },
          { label: '', fr: 'diarrhée' },
        ],
      });
    });

    it('reads the first sheet only', async () => {
      const table = await setUp().parseTable(
        xlsxFile([['label'], ['Fièvre']], 'termes.xlsx', true),
      );

      expect(table.rows).toEqual([{ label: 'Fièvre' }]);
    });

    it('reads a UTF-8 CSV, accents intact, comma- or semicolon-separated', async () => {
      const port = setUp();
      const expected = {
        headers: ['label', 'note', 'fr'],
        rows: [{ label: 'Fièvre', note: 'Été, hiver.', fr: 'fièvre' }],
      };

      expect(
        await port.parseTable(csvFile('Label,Note,FR\nFièvre,"Été, hiver.",fièvre\n')),
      ).toEqual(expected);
      expect(
        await port.parseTable(csvFile('label;note;fr\r\nFièvre;Été, hiver.;fièvre\r\n')),
      ).toEqual(expected);
    });

    it('says a file with no data row is empty, and a broken one unreadable', async () => {
      const port = setUp();

      await expect(port.parseTable(new File([], 'vide.csv'))).rejects.toBeInstanceOf(
        EmptyFileError,
      );
      await expect(port.parseTable(csvFile(''))).rejects.toBeInstanceOf(EmptyFileError);
      await expect(port.parseTable(xlsxFile([['label', 'fr']]))).rejects.toBeInstanceOf(
        EmptyFileError,
      );
      await expect(port.parseTable(xlsxFile([['label'], ['  ']]))).rejects.toBeInstanceOf(
        EmptyFileError,
      );
      await expect(
        port.parseTable(new File([new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3])], 'x.xlsx')),
      ).rejects.toBeInstanceOf(UnreadableFileError);
    });
  });
});
