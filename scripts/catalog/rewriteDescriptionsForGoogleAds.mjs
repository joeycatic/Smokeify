import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEFAULT_LIMIT = 50;

const BLOCKED_TERMS = [
  /\bcannabis\b/gi,
  /\bmarijuana\b/gi,
  /\bweed\b/gi,
  /\bthc\b/gi,
  /\bheadshop\b/gi,
  /\bsmoking\b/gi,
  /\bbong\b/gi,
  /\bpipe(s)?\b/gi,
  /\bbest(e|er|es|en)?\b/gi,
  /\bperfekt(e|er|es|en)?\b/gi,
  /\bultimativ(e|er|es|en)?\b/gi,
  /\bwunder\b/gi,
  /\bgarantie(rt|ren|te)?\b/gi,
  /\b100%\b/gi,
];

const VAGUE_REPLACEMENTS = [
  { pattern: /\bmodern(e|er|es|en)?\b/gi, replacement: "" },
  { pattern: /\bhigh[- ]?end\b/gi, replacement: "" },
  { pattern: /\bstark(e|er|es|en)?\b/gi, replacement: "" },
  { pattern: /\bgunstig(e|er|es|en)?\b/gi, replacement: "preisorientiert" },
  { pattern: /\bideal(e|er|es|en)?\b/gi, replacement: "geeignet" },
  { pattern: /\btop\b/gi, replacement: "" },
  { pattern: /\bmaximal(e|er|es|en)?\b/gi, replacement: "hoch" },
];

const SPEC_PATTERNS = [
  { label: "Leistung", pattern: /\b(?:Eingangsleistung|Leistung)\s*[:\-]?\s*([0-9]+(?:[.,][0-9]+)?\s*(?:W|Watt))/i },
  { label: "Eingangsspannung", pattern: /\b(?:Eingangsspannung|Spannung)\s*[:\-]?\s*([0-9]+(?:[.,][0-9]+)?\s*(?:-|bis)?\s*[0-9.,]*\s*V)/i },
  { label: "PPF", pattern: /\bPPF\s*[:\-]?\s*([0-9]+(?:[.,][0-9]+)?\s*(?:u|mu|µ)mol\/s)/i },
  { label: "Effizienz", pattern: /\b(?:Effizienz|PPE|Wirkungsgrad)\s*[:\-]?\s*([0-9]+(?:[.,][0-9]+)?\s*(?:u|mu|µ)mol\/J)/i },
  { label: "Schutzklasse", pattern: /\b(?:Schutzklasse|Schutzart|IP)\s*[:\-]?\s*(IP[0-9]{2})/i },
  { label: "Abmessungen", pattern: /\b(?:Abmessungen|Ma(?:ss|ß)e?)\s*[:\-]?\s*([0-9]+[0-9.,\sxX-]*(?:mm|cm))/i },
  { label: "Lebensdauer", pattern: /\b(?:Lebensdauer|L90)\s*[:\-]?\s*([>~]?\s*[0-9.]+(?:\s*[0-9.]+)?\s*Stunden)/i },
];

const parseArgs = () => {
  const args = process.argv.slice(2);
  const getValue = (flag) => {
    const idx = args.indexOf(flag);
    if (idx === -1) return null;
    return args[idx + 1] ?? null;
  };
  const idsRaw = getValue("--ids");
  return {
    apply: args.includes("--apply"),
    limit: Number(getValue("--limit") ?? DEFAULT_LIMIT),
    status: getValue("--status"),
    ids: idsRaw
      ? idsRaw
          .split(",")
          .map((entry) => entry.trim())
          .filter(Boolean)
      : [],
  };
};

const stripHtml = (value) =>
  (value ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n- ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();

const cleanSentence = (value) => {
  let next = value;
  for (const entry of VAGUE_REPLACEMENTS) {
    next = next.replace(entry.pattern, entry.replacement);
  }
  return next
    .replace(/\s+/g, " ")
    .replace(/^[,;:.\-\s]+/, "")
    .replace(/\s*[,;:.\-]+\s*$/, "")
    .trim();
};

const isBlocked = (value) =>
  BLOCKED_TERMS.some((pattern) =>
    new RegExp(pattern.source, "i").test(value.toLowerCase())
  );

const toSentences = (value) =>
  value
    .split(/(?<=[.!?])\s+|\n+/)
    .map((entry) => entry.trim())
    .filter(Boolean);

const sanitizeSentenceList = (value) => {
  const seen = new Set();
  const output = [];
  for (const sentence of toSentences(value)) {
    const cleaned = cleanSentence(sentence);
    if (!cleaned) continue;
    if (cleaned.length < 20) continue;
    if (isBlocked(cleaned)) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(cleaned);
  }
  return output;
};

const normalizeInputText = (value) =>
  value
    .replace(/\b(Beschreibung|Produktbeschreibung)\b\s*:?/gi, "")
    .replace(/\b(Technische Daten|Eigenschaften|Lieferumfang|Spezifikationen)\b\s*:/gi, "\n$1:\n")
    .replace(/[•·]/g, "\n- ")
    .replace(/\s*[|]\s*/g, "\n")
    .replace(/\s{2,}/g, " ")
    .trim();

const splitToLines = (value) =>
  value
    .split(/\n+/)
    .flatMap((line) => line.split(/\s*(?:;|(?<=\.)\s+)\s*/))
    .map((line) => cleanSentence(line))
    .filter(Boolean);

const looksLikeSpecLine = (line) =>
  /:/.test(line) ||
  /\b(?:W|Watt|V|Volt|A|Hz|IP[0-9]{2}|mm|cm|kg|g|Stunden|%|(?:u|mu|µ)mol)\b/i.test(
    line
  );

const extractLabeledFacts = (lines) => {
  const items = [];
  const seen = new Set();
  for (const line of lines) {
    const parts = line.split(":");
    if (parts.length < 2) continue;
    const label = cleanSentence(parts.shift() ?? "");
    const value = cleanSentence(parts.join(":"));
    if (!label || !value) continue;
    if (label.length > 45 || value.length > 160) continue;
    if (/^(beschreibung|technische daten|eigenschaften|spezifikationen|lieferumfang)$/i.test(label)) {
      continue;
    }
    const item = `${label}: ${value}`;
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(item);
  }
  return items;
};

const extractPackageItems = (lines) => {
  const items = [];
  const seen = new Set();
  for (const line of lines) {
    const normalized = line.replace(/^-+\s*/, "");
    if (!normalized) continue;
    if (/^lieferumfang:?$/i.test(normalized)) continue;
    if (!/^\d+x\b/i.test(normalized) && !/\b(im lieferumfang|enthalten)\b/i.test(normalized)) {
      continue;
    }
    const cleaned = cleanSentence(normalized.replace(/\b(im lieferumfang|enthalten)\b/gi, ""));
    if (!cleaned || cleaned.length < 4) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(cleaned);
  }
  return items;
};

const uniqueList = (items, limit) => {
  const seen = new Set();
  const output = [];
  for (const item of items) {
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(item);
    if (output.length >= limit) break;
  }
  return output;
};

const extractSpecs = (value) => {
  const items = [];
  for (const rule of SPEC_PATTERNS) {
    const match = value.match(rule.pattern);
    if (!match?.[1]) continue;
    const normalized = match[1].replace(/\s+/g, " ").trim();
    if (!normalized) continue;
    items.push(`${rule.label}: ${normalized}`);
  }
  return items;
};

const escapeHtml = (value) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const buildDescription = (product) => {
  const rawDescription = normalizeInputText(stripHtml(product.description));
  const rawTechnical = normalizeInputText(stripHtml(product.technicalDetails));
  const combined = [rawDescription, rawTechnical].filter(Boolean).join("\n");
  const lines = splitToLines(combined);

  const highlightBullets = uniqueList(
    lines
      .filter((line) => !looksLikeSpecLine(line))
      .filter((line) => line.length >= 20 && line.length <= 180)
      .filter((line) => !isBlocked(line))
      .map((line) => line.replace(/\s*[.!?]*$/, "")),
    8
  );

  const specBullets = uniqueList(
    [
      ...extractSpecs(combined),
      ...extractLabeledFacts(lines).filter((line) => !isBlocked(line)),
      ...lines
        .filter((line) => looksLikeSpecLine(line))
        .filter((line) => !isBlocked(line))
        .filter((line) => line.length <= 180),
    ],
    12
  );

  const packageBullets = uniqueList(
    extractPackageItems(lines).filter((line) => !isBlocked(line)),
    8
  );

  const fallbackText = sanitizeSentenceList(combined).slice(0, 2);
  const intro = `${product.title} fur den Einsatz im Innenbereich.`;

  const html = [
    `<p class="desc-intro">${escapeHtml(intro)}</p>`,
    ...(fallbackText.length
      ? fallbackText.map((line) => `<p class="desc-text">${escapeHtml(line)}</p>`)
      : []),
    ...(highlightBullets.length
      ? [
          '<h3 class="desc-heading">Wichtige Informationen</h3>',
          '<ul class="desc-list">',
          ...highlightBullets.map((line) => `<li class="desc-item">${escapeHtml(line)}</li>`),
          "</ul>",
        ]
      : []),
    ...(specBullets.length
      ? [
          '<h3 class="desc-heading">Technische Daten</h3>',
          '<ul class="desc-list">',
          ...specBullets.map((line) => `<li class="desc-item">${escapeHtml(line)}</li>`),
          "</ul>",
        ]
      : []),
    ...(packageBullets.length
      ? [
          '<h3 class="desc-heading">Lieferumfang</h3>',
          '<ul class="desc-list">',
          ...packageBullets.map((line) => `<li class="desc-item">${escapeHtml(line)}</li>`),
          "</ul>",
        ]
      : []),
  ].join("");

  return html;
};

const main = async () => {
  const options = parseArgs();

  const where = {
    ...(options.status ? { status: options.status } : {}),
    ...(options.ids.length > 0 ? { id: { in: options.ids } } : {}),
  };

  const products = await prisma.product.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take: Number.isFinite(options.limit) && options.limit > 0 ? options.limit : undefined,
    select: {
      id: true,
      title: true,
      description: true,
      technicalDetails: true,
    },
  });

  if (products.length === 0) {
    console.log("No products matched the filter.");
    return;
  }

  let changed = 0;
  for (const product of products) {
    const rewritten = buildDescription(product);
    const previous = (product.description ?? "").trim();
    if (previous === rewritten.trim()) continue;

    changed += 1;
    console.log(`\n[${product.id}] ${product.title}`);
    console.log("Before:");
    console.log(previous || "<empty>");
    console.log("After:");
    console.log(rewritten);

    if (options.apply) {
      await prisma.product.update({
        where: { id: product.id },
        data: { description: rewritten },
      });
    }
  }

  console.log(
    `\nProcessed: ${products.length} | Rewritten: ${changed} | Mode: ${
      options.apply ? "apply" : "dry-run"
    }`
  );
};

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
