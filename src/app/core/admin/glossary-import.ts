import type { Language } from '../catalog/catalog.model';
import {
  EmptyFileError,
  foldHeader,
  type ImportedTable,
} from '../spreadsheet/spreadsheet-import-port';

/** A term as a spreadsheet row gives it: synonyms and forms to avoid are set here afterwards. */
export interface ImportedTerm {
  readonly label: string;
  readonly note: string | null;
  readonly forms: readonly { readonly languageId: string; readonly preferred: string }[];
}

const LABEL = 'label';
const NOTE = 'note';

/** The header row names no `label` column. */
export class MissingLabelColumnError extends Error {
  override readonly name = 'MissingLabelColumnError';
  constructor() {
    super('no label column');
  }
}

/** Headers that are neither `label`, `note` nor the code of a known language. */
export class UnknownColumnsError extends Error {
  override readonly name = 'UnknownColumnsError';
  constructor(readonly headers: readonly string[]) {
    super(`unknown column(s): ${headers.join(', ')}`);
  }
}

/**
 * The terms a table gives: one per row with a label, its note if any, and a preferred form in
 * each language whose column (headed by the language's code) is filled on that row.
 *
 * Fails with `MissingLabelColumnError` or `UnknownColumnsError`, so that nothing is half-read;
 * with `EmptyFileError` when no row has a label.
 */
export function termsFromTable(
  table: ImportedTable,
  languages: readonly Language[],
): ImportedTerm[] {
  if (!table.headers.includes(LABEL)) throw new MissingLabelColumnError();
  const byCode = new Map(languages.map((language) => [foldHeader(language.code), language]));
  const others = table.headers.filter((header) => header !== LABEL && header !== NOTE);
  const unknown = others.filter((header) => !byCode.has(header));
  if (unknown.length > 0) throw new UnknownColumnsError(unknown);

  const terms = table.rows
    .filter((row) => (row[LABEL] ?? '') !== '')
    .map((row) => ({
      label: row[LABEL],
      note: (row[NOTE] ?? '') === '' ? null : row[NOTE],
      forms: others
        .filter((code) => (row[code] ?? '') !== '')
        .map((code) => ({ languageId: byCode.get(code)!.id, preferred: row[code] })),
    }));
  if (terms.length === 0) throw new EmptyFileError();
  return terms;
}
