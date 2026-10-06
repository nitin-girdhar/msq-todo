// Minimal RFC 4180 CSV writer for the task export.
//
// Task titles, descriptions and names are typed by users, so a cell that starts
// with = + - @ (or a tab / CR) would be run as a formula when the file is opened
// in Excel or Sheets. Those cells are prefixed with an apostrophe so they stay text
// (OWASP "CSV injection").

const FORMULA_START = /^[=+\-@\t\r]/;

function cell(value: unknown): string {
  if (value === null || value === undefined) return '';
  let text: string;
  if (value instanceof Date) text = value.toISOString();
  else if (Array.isArray(value)) text = value.map((v) => String(v)).join('; ');
  else text = String(value);
  if (FORMULA_START.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(headers: readonly string[], rows: ReadonlyArray<ReadonlyArray<unknown>>): string {
  const lines = [headers.map(cell).join(',')];
  for (const row of rows) lines.push(row.map(cell).join(','));
  // BOM so Excel opens UTF-8 (Hindi titles) correctly; CRLF per the RFC.
  return `﻿${lines.join('\r\n')}\r\n`;
}
