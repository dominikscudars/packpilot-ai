/**
 * CSV export helpers. Cells that a spreadsheet could run as a formula
 * (starting with =, +, -, @, tab or carriage return) are prefixed with an
 * apostrophe so they are shown as text, never executed.
 */
export function safeCell(value: string | number | null): string {
  let text = value === null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text) && !/^-?\d+(\.\d+)?$/.test(text))
    text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows: (string | number | null)[][]): string {
  return rows.map((row) => row.map(safeCell).join(",")).join("\r\n");
}
