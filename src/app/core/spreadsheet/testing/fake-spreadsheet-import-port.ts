import {
  SpreadsheetImportPort,
  type ImportedPair,
  type ImportedTable,
} from '../spreadsheet-import-port';

type Answer<T> = T | Error | Promise<T>;

/**
 * A `SpreadsheetImportPort` answering by file name: pairs or tables resolve, an `Error` rejects
 * with it, a `Promise` is returned as-is (to hold a read pending). An unknown name rejects, so a
 * test cannot pass by reading a file it did not set up. Every file it was handed is kept, in order.
 */
export class FakeSpreadsheetImportPort extends SpreadsheetImportPort {
  readonly answers: Record<string, Answer<ImportedPair[]>> = {};
  readonly tables: Record<string, Answer<ImportedTable>> = {};
  readonly files: File[] = [];

  parsePairs(file: File): Promise<ImportedPair[]> {
    return this.#answer(this.answers, file);
  }

  parseTable(file: File): Promise<ImportedTable> {
    return this.#answer(this.tables, file);
  }

  #answer<T>(answers: Record<string, Answer<T>>, file: File): Promise<T> {
    this.files.push(file);
    const answer = answers[file.name];
    if (answer === undefined) return Promise.reject(new Error(`no answer for ${file.name}`));
    if (answer instanceof Error) return Promise.reject(answer);
    return Promise.resolve(answer);
  }
}

/** A file only its name matters for: the fake port answers by name. */
export const namedFile = (name: string) => new File(['…'], name);
