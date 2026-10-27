import type { Provider } from '@angular/core';
import { SheetJsSpreadsheetImportAdapter } from './sheetjs-spreadsheet-import-adapter';
import { SpreadsheetImportPort } from './spreadsheet-import-port';

export function provideSpreadsheetImport(): Provider[] {
  return [{ provide: SpreadsheetImportPort, useClass: SheetJsSpreadsheetImportAdapter }];
}
