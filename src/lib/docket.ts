// Helpers for the firm docket: prefix derivation from a contact name,
// formatting, and parsing.

const KNOWN_SUFFIXES = new Set([
  "JR",
  "SR",
  "II",
  "III",
  "IV",
  "V",
  "ESQ",
  "ESQUIRE",
  "PHD",
  "MD",
  "DDS",
]);

/**
 * Derive the docket prefix (two uppercase letters) from a contact name.
 * Takes the last whitespace-separated token after stripping known suffixes
 * (Jr., Sr., III, etc.), keeps only A-Z, and returns the first two chars.
 * Pads with X if the result is under two letters.
 *
 * "Nathan Gugliotta" → "GU"
 * "Mary Beth O'Brien" → "OB"
 * "John Smith Jr." → "SM"
 * "Madonna" → "MA"
 * "Lo" → "LO"
 * "X" → "XX"
 */
export function derivePrefix(name: string | null | undefined): string {
  if (!name) return "XX";
  const tokens = name
    .trim()
    .split(/\s+/)
    .map((t) => t.replace(/[^A-Za-z]/g, ""))
    .filter((t) => t.length > 0);

  let lastIdx = tokens.length - 1;
  while (
    lastIdx > 0 &&
    KNOWN_SUFFIXES.has(tokens[lastIdx].toUpperCase())
  ) {
    lastIdx--;
  }
  const surname = tokens[lastIdx] ?? "";
  const prefix = surname.slice(0, 2).toUpperCase();
  if (prefix.length === 2) return prefix;
  if (prefix.length === 1) return prefix + "X";
  return "XX";
}

/**
 * Format a sequence number into a docket string.
 *   formatDocket("GU", 7186) → "GU-7186"
 * No zero-padding — the firm's existing dockets are not padded once they
 * exceed 4 digits (e.g. they're already past 7000).
 */
export function formatDocket(prefix: string, sequence: number): string {
  return `${prefix}-${sequence}`;
}

/**
 * Parse the numeric portion out of a docket string.
 *   parseDocketSequence("GU-7186") → 7186
 *   parseDocketSequence("anything else") → null
 */
export function parseDocketSequence(docket: string | null | undefined): number | null {
  if (!docket) return null;
  const m = docket.trim().match(/^[A-Za-z]{2}-(\d+)$/);
  if (!m) return null;
  return Number.parseInt(m[1], 10);
}

/**
 * Split a contact name into first / last for sheet columns.
 * Mirrors derivePrefix: strips known suffixes, last token is last name,
 * everything else joined is first name.
 */
export function splitName(name: string | null | undefined): {
  firstName: string;
  lastName: string;
} {
  if (!name) return { firstName: "", lastName: "" };
  const tokens = name.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return { firstName: "", lastName: "" };
  if (tokens.length === 1) return { firstName: "", lastName: tokens[0] };

  let lastIdx = tokens.length - 1;
  while (lastIdx > 0) {
    const stripped = tokens[lastIdx].replace(/[^A-Za-z]/g, "");
    if (KNOWN_SUFFIXES.has(stripped.toUpperCase())) {
      lastIdx--;
    } else {
      break;
    }
  }
  return {
    firstName: tokens.slice(0, lastIdx).join(" "),
    lastName: tokens[lastIdx],
  };
}

/** Format a Date as the firm's spreadsheet wants: M/D/YYYY (no zero pad). */
export function formatSheetDate(d: Date = new Date()): string {
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}
