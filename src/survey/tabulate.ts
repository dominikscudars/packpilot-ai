/**
 * Turns a Google Forms response export (CSV download, or cells copied from
 * Google Sheets / Excel) into answer counts per question. Pure functions, so
 * results are reproducible and nothing leaves the browser.
 */

export interface QuestionResult {
  question: string;
  kind: "choice" | "text";
  answered: number;
  /** For choice questions: answers with counts, most common first. */
  answers: { label: string; count: number }[];
  /** For free-text questions: a few example answers. */
  examples: string[];
}

/** Parses CSV (comma) or TSV (tab, as pasted from a spreadsheet). */
export function parseTable(text: string): string[][] {
  const clean = text.replace(/^﻿/, "").replace(/\r\n?/g, "\n").trim();
  if (!clean) return [];
  const firstLine = clean.slice(0, clean.indexOf("\n") >>> 0);
  const delimiter = firstLine.includes("\t") ? "\t" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (quoted) {
      if (c === '"' && clean[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"' && field === "") quoted = true;
    else if (c === delimiter) {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  row.push(field);
  rows.push(row);
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

const isTimestamp = (header: string) =>
  /^(timestamp|laika zīmogs|time|date|datums)$/i.test(header.trim());

/** Counts answers per question; checkbox answers ("A, B") are split. */
export function tabulate(rows: string[][]): {
  responses: number;
  questions: QuestionResult[];
} {
  const [header = [], ...body] = rows;
  const questions: QuestionResult[] = [];
  header.forEach((question, col) => {
    if (!question.trim() || isTimestamp(question)) return;
    const cells = body.map((r) => (r[col] ?? "").trim()).filter(Boolean);
    if (cells.length === 0) return;
    // Google Forms joins checkbox answers with ", ". Split only when the
    // parts repeat across responses, so free text with commas stays whole.
    const parts = cells.flatMap((c) => c.split(", ").map((p) => p.trim()));
    const partCounts = new Map<string, number>();
    for (const p of parts) partCounts.set(p, (partCounts.get(p) ?? 0) + 1);
    const repeated = [...partCounts.values()].filter((n) => n > 1).length;
    // A single-choice question has a few distinct whole answers (even with
    // commas, like "Yes, regularly"); a checkbox question has many distinct
    // combinations built from fewer repeated parts.
    const distinctWhole = new Set(cells).size;
    const multi =
      cells.some((c) => c.includes(", ")) &&
      distinctWhole > 8 &&
      partCounts.size < distinctWhole &&
      repeated >= Math.min(3, partCounts.size) &&
      partCounts.size <= 25;
    // Answers that differ only in letter case ("Depo" / "depo") are merged
    // under the first spelling seen.
    const counts = new Map<string, number>();
    const spelling = new Map<string, string>();
    for (const cell of cells)
      for (const raw of multi ? cell.split(", ") : [cell]) {
        const key = raw.trim().toLocaleLowerCase();
        if (!spelling.has(key)) spelling.set(key, raw.trim());
        const label = spelling.get(key) ?? raw.trim();
        counts.set(label, (counts.get(label) ?? 0) + 1);
      }
    const distinct = counts.size;
    const longAnswers =
      cells.reduce((sum, c) => sum + c.length, 0) / cells.length > 30;
    const kind: QuestionResult["kind"] =
      !multi && (distinct > 12 || (longAnswers && distinct > cells.length / 2))
        ? "text"
        : "choice";
    questions.push({
      question: question.trim(),
      kind,
      answered: cells.length,
      answers:
        kind === "choice"
          ? [...counts]
              .map(([label, count]) => ({ label, count }))
              .sort(
                (a, b) => b.count - a.count || a.label.localeCompare(b.label),
              )
          : [],
      examples:
        kind === "text" ? cells.filter((c) => c.length > 3).slice(0, 6) : [],
    });
  });
  return { responses: body.length, questions };
}

const pct = (n: number, total: number) =>
  total === 0 ? "0%" : `${Math.round((n / total) * 100)}%`;

/** Compact text summary for the market research assistant. */
export function summaryText(
  responses: number,
  questions: QuestionResult[],
  maxLength = 7500,
): string {
  const lines = [`${responses} responses.`];
  for (const q of questions) {
    lines.push("", `Q: ${q.question} (${q.answered} answered)`);
    if (q.kind === "choice")
      for (const a of q.answers.slice(0, 10))
        lines.push(`- ${a.label}: ${a.count} (${pct(a.count, q.answered)})`);
    else for (const e of q.examples) lines.push(`- "${e.slice(0, 160)}"`);
  }
  const text = lines.join("\n");
  return text.length > maxLength ? `${text.slice(0, maxLength)}\n…` : text;
}
