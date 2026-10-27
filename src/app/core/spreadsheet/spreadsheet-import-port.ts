/** A question and its answer as read from a spreadsheet row, both already trimmed. */
export interface ImportedPair {
  readonly question: string;
  readonly answer: string;
}

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
 * Question-answer pairs read from a spreadsheet the author chose, as the application needs them:
 * the first sheet, its first row naming the columns, each row after it a pair. Rows blank in both
 * cells are left out; a row with only one half is kept, for the form to flag.
 *
 * Fails with `MissingColumnError`, `EmptyFileError` or `UnreadableFileError` — never with the
 * library's own errors, whose shapes are the adapter's business. An abstract class, so it is both
 * the contract and the injection token.
 */
export abstract class SpreadsheetImportPort {
  abstract parsePairs(file: File): Promise<ImportedPair[]>;
}
