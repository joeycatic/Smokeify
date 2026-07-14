const GTIN_SEMICOLON_PATTERN = /(^|>|\n|\r)\s*;\s*(GTIN\s*:)/gi;
const STRUCTURED_ROW_PATTERN = /^([^:]{1,80}):\s*(.+)$/;

const decodeEntities = (value: string) =>
  value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const stripHtmlToLines = (value: string) =>
  decodeEntities(
    value
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<\/li>/gi, "\n")
      .replace(/<\/h[2-4]>/gi, "\n")
      .replace(/<li[^>]*>/gi, "")
      .replace(/<[^>]+>/g, "")
      .replace(/\u00a0/g, " "),
  )
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

function normalizeTechnicalDetailsHtml(raw?: string | null) {
  if (!raw) return "";

  return raw.replace(
    GTIN_SEMICOLON_PATTERN,
    (_match, prefix: string, label: string) => `${prefix}${label}`,
  );
}

function buildSpecsTableHtml(lines: string[]) {
  const rows = lines
    .map((line) => {
      const match = line.match(STRUCTURED_ROW_PATTERN);
      if (!match) return null;

      return {
        label: match[1].trim(),
        value: match[2].trim(),
      };
    })
    .filter(Boolean) as Array<{ label: string; value: string }>;

  if (rows.length < 3 || rows.length / lines.length < 0.7) {
    return null;
  }

  return [
    "<table><tbody>",
    ...rows.map(
      (row) =>
        `<tr><td>${escapeHtml(row.label)}</td><td>${escapeHtml(row.value)}</td></tr>`,
    ),
    "</tbody></table>",
  ].join("");
}

export function normalizeTechnicalDetailsHtmlForDisplay(raw?: string | null) {
  const normalized = normalizeTechnicalDetailsHtml(raw);
  if (!normalized) return "";
  if (/<table[\s>]/i.test(normalized)) return normalized;

  const lines = stripHtmlToLines(normalized);
  const tableHtml = buildSpecsTableHtml(lines);

  return tableHtml ?? normalized;
}
