/**
 * Text the citizen typed, made safe to paste into a spreadsheet as tab-separated cells: tabs and
 * line breaks would split cells, and a leading = + - @ would turn the cell into a formula
 * (formula injection, OWASP). The apostrophe makes spreadsheets keep it as plain text.
 */
export function spreadsheetCell(value: string): string {
  const flat = value.replace(/[\t\r\n]+/g, " ");
  return /^[=+\-@]/.test(flat) ? `'${flat}` : flat;
}

/** Label/value pairs as tab-separated lines, each cell made safe. */
export function spreadsheetRows(rows: [string, string][]): string {
  return rows.map((cells) => cells.map(spreadsheetCell).join("\t")).join("\n");
}
