import * as XLSX from 'xlsx';

/** A real workbook, as Excel would save it: the rows go in the first sheet. */
export function xlsxFile(rows: unknown[][], name = 'paires.xlsx', extraSheet = false): File {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), 'Paires');
  if (extraSheet) {
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([['autre'], ['ignoré']]), 'Notes');
  }
  const bytes = XLSX.write(book, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  return new File([bytes], name, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

export const csvFile = (text: string, name = 'paires.csv') =>
  new File([text], name, { type: 'text/csv' });
