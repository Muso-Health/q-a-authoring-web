import { Service } from '@angular/core';
import {
  ACCEPTED_HEADERS,
  EmptyFileError,
  MissingColumnError,
  SpreadsheetImportPort,
  UnreadableFileError,
  foldHeader,
  type ImportedPair,
  type ImportedTable,
  type PairColumn,
} from './spreadsheet-import-port';

const cell = (value: unknown): string =>
  value === null || value === undefined ? '' : String(value).trim();

const folded = (value: unknown): string => foldHeader(cell(value));

const HEADERS: Readonly<Record<PairColumn, readonly string[]>> = {
  question: ACCEPTED_HEADERS.question.map(folded),
  answer: ACCEPTED_HEADERS.answer.map(folded),
};

const isCsv = (file: File) => /\.csv$/i.test(file.name) || file.type === 'text/csv';

/** A sheet's rows as pairs: the first row names the columns, each row after it is a pair. */
function pairsFromRows(rows: readonly (readonly unknown[])[]): ImportedPair[] {
  if (rows.length === 0) throw new EmptyFileError();
  const headers = rows[0].map(folded);
  const index = (column: PairColumn) => headers.findIndex((h) => HEADERS[column].includes(h));
  const at = { question: index('question'), answer: index('answer') };
  const missing = (['question', 'answer'] as const).filter((column) => at[column] < 0);
  if (missing.length > 0) throw new MissingColumnError(missing);

  const pairs = rows
    .slice(1)
    .map((row) => ({ question: cell(row[at.question]), answer: cell(row[at.answer]) }))
    .filter((pair) => pair.question !== '' || pair.answer !== '');
  if (pairs.length === 0) throw new EmptyFileError();
  return pairs;
}

/** A sheet's rows by their folded headers; the unnamed columns and the blank rows left out. */
function tableFromRows(rows: readonly (readonly unknown[])[]): ImportedTable {
  if (rows.length === 0) throw new EmptyFileError();
  const columns = rows[0]
    .map((header, index) => ({ header: folded(header), index }))
    .filter(({ header }) => header !== '');
  const records = rows
    .slice(1)
    .map((row) =>
      Object.fromEntries(columns.map(({ header, index }) => [header, cell(row[index])])),
    )
    .filter((record) => Object.values(record).some((value) => value !== ''));
  if (records.length === 0) throw new EmptyFileError();
  return { headers: columns.map(({ header }) => header), rows: records };
}

/**
 * The spreadsheet import, read in the browser by SheetJS CE: an .xlsx's first sheet, or a .csv.
 * SheetJS is loaded only on the first import, so it stays out of every bundle a reader downloads;
 * none of its types or errors leave this file.
 *
 * A CSV is decoded as text first: handed over as bytes, SheetJS would take it for Latin-1 and
 * mangle every accent of a UTF-8 file.
 */
@Service()
export class SheetJsSpreadsheetImportAdapter extends SpreadsheetImportPort {
  async parsePairs(file: File): Promise<ImportedPair[]> {
    if (file.size === 0) throw new EmptyFileError();
    return pairsFromRows(await this.#rows(file));
  }

  async parseTable(file: File): Promise<ImportedTable> {
    if (file.size === 0) throw new EmptyFileError();
    return tableFromRows(await this.#rows(file));
  }

  async #rows(file: File): Promise<unknown[][]> {
    try {
      const XLSX = await import('xlsx');
      const book = isCsv(file)
        ? XLSX.read(await file.text(), { type: 'string', raw: true })
        : XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const first = book.SheetNames[0];
      if (first === undefined) return [];
      return XLSX.utils.sheet_to_json<unknown[]>(book.Sheets[first], {
        header: 1,
        defval: '',
        raw: false,
        blankrows: false,
      });
    } catch (error) {
      throw new UnreadableFileError({ cause: error });
    }
  }
}
