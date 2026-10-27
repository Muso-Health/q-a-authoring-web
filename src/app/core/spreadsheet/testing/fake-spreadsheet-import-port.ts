import { SpreadsheetImportPort, type ImportedPair } from '../spreadsheet-import-port';

/**
 * A `SpreadsheetImportPort` answering by file name: pairs resolve, an `Error` rejects with it, a
 * `Promise` is returned as-is (to hold a read pending). An unknown name rejects, so a test cannot
 * pass by reading a file it did not set up. Every file it was handed is kept, in order.
 */
export class FakeSpreadsheetImportPort extends SpreadsheetImportPort {
  readonly answers: Record<string, ImportedPair[] | Error | Promise<ImportedPair[]>> = {};
  readonly files: File[] = [];

  parsePairs(file: File): Promise<ImportedPair[]> {
    this.files.push(file);
    const answer = this.answers[file.name];
    if (answer === undefined) return Promise.reject(new Error(`no answer for ${file.name}`));
    if (answer instanceof Error) return Promise.reject(answer);
    return Promise.resolve(answer);
  }
}

/** A file only its name matters for: the fake port answers by name. */
export const namedFile = (name: string) => new File(['…'], name);
