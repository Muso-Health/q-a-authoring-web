/** A question and its answer as read from a spreadsheet row, both already trimmed. */
export interface ImportedPair {
  readonly question: string;
  readonly answer: string;
}

/** What a file picker offers for an import: .xlsx and .csv. */
export const SPREADSHEET_TYPES = [
  '.xlsx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.csv',
  'text/csv',
].join(',');

/**
 * A sheet as it was laid out: the first row's headers, folded (no case, accents or surrounding
 * spaces), and each row after it by folded header, every cell trimmed — blank ones as ''.
 * Columns without a header are left out, and so are rows blank in every cell.
 */
export interface ImportedTable {
  readonly headers: readonly string[];
  readonly rows: readonly Readonly<Record<string, string>>[];
}

/** A header as the table names it: trimmed, without case or accents. */
export const foldHeader = (header: string): string =>
  header
    .trim()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

export type PairColumn = 'question' | 'answer';

/** The headers each column answers to, compared without case, accents or surrounding spaces. */
export const ACCEPTED_HEADERS: Readonly<Record<PairColumn, readonly string[]>> = {
  question: ['question'],
  answer: ['réponse', 'answer'],
};

/** The header row names no question column, no answer column, or neither. */
export class MissingColumnError extends Error {
  override readonly name = 'MissingColumnError';
  /** The headers that would have been accepted, per missing column. */
  readonly accepted: Readonly<Partial<Record<PairColumn, readonly string[]>>>;

  constructor(readonly columns: readonly PairColumn[]) {
    super(`missing column(s): ${columns.join(', ')}`);
    this.accepted = Object.fromEntries(columns.map((column) => [column, ACCEPTED_HEADERS[column]]));
  }
}

/** The file holds no pair: nothing at all, a header row only, or only blank rows. */
export class EmptyFileError extends Error {
  override readonly name = 'EmptyFileError';
  constructor() {
    super('the file holds no pair');
  }
}

/** The file is not a spreadsheet that can be read. */
export class UnreadableFileError extends Error {
  override readonly name = 'UnreadableFileError';
  constructor(options?: ErrorOptions) {
    super('the file could not be read', options);
  }
}

/**
 * A spreadsheet the user chose, read in the browser: always its first sheet, the first row naming
 * the columns.
 *
 * `parsePairs` reads question-answer pairs, as the application needs them: each row after the
 * headers a pair. Rows blank in both cells are left out; a row with only one half is kept, for the
 * form to flag. `parseTable` reads any columns, for the caller to make sense of.
 *
 * Both fail with `EmptyFileError` (no data row) or `UnreadableFileError`, `parsePairs` also with
 * `MissingColumnError` — never with the library's own errors, whose shapes are the adapter's
 * business. An abstract class, so it is both
 * the contract and the injection token.
 */
export abstract class SpreadsheetImportPort {
  abstract parsePairs(file: File): Promise<ImportedPair[]>;
  abstract parseTable(file: File): Promise<ImportedTable>;
}
