// ── CSV read/write helpers ───────────────────────────────────────────────────
// One home for the CSV logic that was previously copy-pasted into each form
// that needed it (the quiz generator's five export formats each had their own
// row builder over the same two helpers).
//
// The parsing half is new: nothing in the app could read a CSV until the admin
// console needed to accept a list of teacher emails as an upload.
//
// Everything here is pure string work except triggerDownload/downloadCsv, which
// touch the DOM and are therefore browser-only — importing this module on the
// server is fine as long as those two aren't called.

/** Quote a single cell. Always quoted (not just when it contains a comma) so
 *  the output is stable and diffable, with inner quotes doubled per RFC 4180. */
export function csvCell(value: unknown): string {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

/** Join one row of cells. */
export function csvRow(cells: unknown[]): string {
  return cells.map(csvCell).join(",");
}

/**
 * Build a full CSV document from a header row and body rows.
 *
 * Prepends a UTF-8 BOM: without it Excel on Windows reads the file as the
 * system codepage, which mangles any accented character — and teacher names
 * routinely contain them. Sheets and LibreOffice ignore the BOM.
 */
export function toCsv(headers: string[], rows: unknown[][]): string {
  return "﻿" + [csvRow(headers), ...rows.map(csvRow)].join("\r\n");
}

/** Browser-only: push a Blob to the user as a file download. */
export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Browser-only: download a string as a .csv file. */
export function downloadCsv(content: string, filename: string): void {
  triggerDownload(new Blob([content], { type: "text/csv;charset=utf-8;" }), filename);
}

/**
 * Split one CSV line into cells, honouring quoted fields.
 *
 * A naive `line.split(",")` breaks on the single most common real-world case —
 * a quoted field containing a comma ("Smith, Jane") — so this walks the string
 * instead. A doubled quote inside a quoted field ("") is an escaped quote.
 */
export function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = "";
  let quoted = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"';
        i++; // skip the second quote of the escaped pair
      } else {
        quoted = !quoted;
      }
    } else if (ch === "," && !quoted) {
      cells.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  cells.push(cur.trim());
  return cells;
}

/**
 * Parse a whole CSV document into rows of cells.
 *
 * Strips a leading BOM (files we ourselves exported round-trip cleanly) and
 * handles CRLF, LF and lone-CR line endings, since uploads arrive from Excel,
 * Sheets and hand-edited files alike. Blank lines are dropped.
 *
 * Note: a newline *inside* a quoted field is not supported — that would need a
 * character-level parse of the whole document rather than a line split. No
 * current caller needs it (emails and names don't contain newlines), so this
 * stays simple rather than speculatively general.
 */
export function parseCsv(text: string): string[][] {
  return text
    .replace(/^﻿/, "")
    .split(/\r\n|\n|\r/)
    .filter((line) => line.trim() !== "")
    .map(parseCsvLine);
}
