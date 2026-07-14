type ProductSearchDocument = {
  title?: string | null;
  handle?: string | null;
  manufacturer?: string | null;
  shortDescription?: string | null;
  description?: string | null;
  technicalDetails?: string | null;
  tags?: Array<string | null | undefined>;
  categories?: Array<string | null | undefined>;
  collections?: Array<string | null | undefined>;
  variantTitles?: Array<string | null | undefined>;
  variantSkus?: Array<string | null | undefined>;
  extra?: Array<string | null | undefined>;
};

export type ProductSearchSynonymMap = Record<string, string[]>;

const MAX_QUERY_TOKENS = 6;
const MAX_GROUP_TERMS = 8;
const MAX_FUZZY_TERMS = 3;

const SEARCH_STOP_WORDS = new Set([
  "aber",
  "auf",
  "bitte",
  "brauche",
  "das",
  "dem",
  "den",
  "der",
  "die",
  "ein",
  "eine",
  "einen",
  "einer",
  "finde",
  "fuer",
  "ich",
  "im",
  "in",
  "mein",
  "meine",
  "mit",
  "moechte",
  "oder",
  "suche",
  "suchen",
  "und",
  "von",
  "will",
  "zu",
  "zum",
  "zur",
]);

const DEFAULT_SEARCH_SYNONYMS: ProductSearchSynonymMap = {
  "bio bizz": ["biobizz"],
  biobizz: ["bio bizz", "bio-bizz"],
  "bio-bizz": ["biobizz", "bio bizz"],
  ph: ["ph wert", "phwert", "p h"],
  phwert: ["ph", "ph wert"],
  "ph wert": ["ph", "phwert"],
  vbx: ["hydroponic research", "vbx clean"],
  shine: ["shine bloom", "hydroponic research"],
  growbox: ["growzelt", "pflanzenzelt", "zelt", "tent", "box"],
  box: ["growbox", "growzelt", "pflanzenzelt", "zelt", "tent"],
  growzelt: ["growbox", "pflanzenzelt", "zelt", "tent"],
  pflanzenzelt: ["growbox", "growzelt", "zelt", "tent"],
  zelt: ["growbox", "growzelt", "pflanzenzelt", "tent"],
  tent: ["growbox", "growzelt", "pflanzenzelt", "zelt"],
  led: ["lampe", "light", "growlight"],
  lampe: ["led", "light", "growlight"],
  light: ["led", "lampe", "growlight"],
  growlight: ["led", "lampe", "light"],
  abluft: ["luefter", "lufter", "ventilator", "fan", "inline"],
  luefter: ["abluft", "lufter", "ventilator", "fan", "inline"],
  lufter: ["abluft", "luefter", "ventilator", "fan", "inline"],
  ventilator: ["abluft", "luefter", "lufter", "fan", "inline"],
  fan: ["abluft", "luefter", "lufter", "ventilator", "inline"],
  filter: ["aktivkohlefilter", "carbon"],
  aktivkohle: ["carbon", "kohle", "filter"],
  aktivkohlefilter: ["carbon", "aktivkohle", "filter"],
  bong: ["wasserpfeife", "waterpipe"],
  grinder: ["muehle", "muhle"],
  vaporizer: ["vape", "verdampfer"],
  duenger: ["dunger", "fertilizer", "naehrstoff", "nutrient"],
  dunger: ["duenger", "fertilizer", "naehrstoff", "nutrient"],
  fertilizer: ["duenger", "naehrstoff", "nutrient"],
  naehrstoff: ["duenger", "fertilizer", "nutrient"],
  nutrient: ["duenger", "fertilizer", "naehrstoff"],
  bewaesserung: ["watering", "irrigation"],
  watering: ["bewaesserung", "irrigation"],
  irrigation: ["bewaesserung", "watering"],
};

const stripHtml = (value: string) => value.replace(/<[^>]*>/g, " ");

export const normalizeProductSearchText = (value: string) =>
  stripHtml(value)
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const compactSearchText = (value: string) =>
  normalizeProductSearchText(value).replace(/\s+/g, "");

const buildSynonymMap = (synonyms?: ProductSearchSynonymMap) => {
  if (!synonyms) return DEFAULT_SEARCH_SYNONYMS;

  const merged: ProductSearchSynonymMap = { ...DEFAULT_SEARCH_SYNONYMS };
  for (const [key, values] of Object.entries(synonyms)) {
    const normalizedKey = normalizeProductSearchText(key);
    if (!normalizedKey) continue;

    const mergedValues = new Set(merged[normalizedKey] ?? []);
    for (const value of values ?? []) {
      const normalizedValue = normalizeProductSearchText(value);
      if (normalizedValue) {
        mergedValues.add(normalizedValue);
      }
    }
    merged[normalizedKey] = Array.from(mergedValues);
  }

  return merged;
};

const toDeleteDistanceOne = (token: string) => {
  if (token.length < 5) return [];

  const variants = new Set<string>();
  for (let index = 0; index < token.length; index += 1) {
    variants.add(token.slice(0, index) + token.slice(index + 1));
  }

  return Array.from(variants);
};

const buildDimensionVariants = (token: string) => {
  const match = token.match(/^(\d{2,4})x(\d{2,4})(x(\d{2,4}))?$/);
  if (!match) return [];

  const [, first, second, thirdChunk, third = ""] = match;
  if (thirdChunk) {
    return [`${first} x ${second} x ${third}`, `${first}${second}${third}`];
  }

  return [`${first} x ${second}`, `${first}${second}`];
};

const normalizeValues = (values: Array<string | null | undefined>) =>
  values
    .map((value) => normalizeProductSearchText(value ?? ""))
    .filter(Boolean);

const buildPreparedField = (values: Array<string | null | undefined>) => {
  const text = normalizeValues(values).join(" ");
  return {
    text,
    compact: text.replace(/\s+/g, ""),
  };
};

const matchesPreparedField = (
  field: { text: string; compact: string },
  term: string,
) => {
  const normalizedTerm = normalizeProductSearchText(term);
  if (!normalizedTerm) return false;

  if (field.text.includes(normalizedTerm)) {
    return true;
  }

  const compactTerm = normalizedTerm.replace(/\s+/g, "");
  return compactTerm.length >= 3 && field.compact.includes(compactTerm);
};

const getGroupFieldScore = (
  field: { text: string; compact: string },
  group: string[],
  score: number,
) => (group.some((term) => matchesPreparedField(field, term)) ? score : 0);

const getPhraseFieldScore = (
  field: { text: string; compact: string },
  query: string,
  exactScore: number,
  startsWithScore: number,
  includesScore: number,
) => {
  const normalizedQuery = normalizeProductSearchText(query);
  if (!normalizedQuery) return 0;

  const compactQuery = normalizedQuery.replace(/\s+/g, "");
  if (
    field.text === normalizedQuery ||
    (compactQuery.length >= 3 && field.compact === compactQuery)
  ) {
    return exactScore;
  }

  if (
    field.text.startsWith(normalizedQuery) ||
    (compactQuery.length >= 3 && field.compact.startsWith(compactQuery))
  ) {
    return startsWithScore;
  }

  if (
    field.text.includes(normalizedQuery) ||
    (compactQuery.length >= 3 && field.compact.includes(compactQuery))
  ) {
    return includesScore;
  }

  return 0;
};

const buildSearchIndex = (document: ProductSearchDocument) => {
  const title = buildPreparedField([document.title]);
  const handle = buildPreparedField([document.handle]);
  const manufacturer = buildPreparedField([document.manufacturer]);
  const shortDescription = buildPreparedField([document.shortDescription]);
  const description = buildPreparedField([document.description]);
  const technicalDetails = buildPreparedField([document.technicalDetails]);
  const tags = buildPreparedField(document.tags ?? []);
  const categories = buildPreparedField(document.categories ?? []);
  const collections = buildPreparedField(document.collections ?? []);
  const variantTitles = buildPreparedField(document.variantTitles ?? []);
  const variantSkus = buildPreparedField(document.variantSkus ?? []);
  const extra = buildPreparedField(document.extra ?? []);
  const all = buildPreparedField([
    title.text,
    handle.text,
    manufacturer.text,
    shortDescription.text,
    description.text,
    technicalDetails.text,
    tags.text,
    categories.text,
    collections.text,
    variantTitles.text,
    variantSkus.text,
    extra.text,
  ]);

  return {
    title,
    handle,
    manufacturer,
    shortDescription,
    description,
    technicalDetails,
    tags,
    categories,
    collections,
    variantTitles,
    variantSkus,
    extra,
    all,
  };
};

export const buildProductSearchTermGroups = (
  query: string,
  options?: { synonyms?: ProductSearchSynonymMap },
) => {
  const synonymMap = buildSynonymMap(options?.synonyms);
  const dimensionSafeQuery = query.replace(/(\d)\s*[x×]\s*(\d)/gi, "$1x$2");
  const normalizedQuery = normalizeProductSearchText(dimensionSafeQuery);
  const rawTokens = normalizedQuery
    .split(" ")
    .map((token) => token.trim())
    .filter(Boolean);
  const allowSingleCharacterToken =
    rawTokens.length === 1 && rawTokens[0]?.length === 1;
  const tokens = rawTokens
    .filter(
      (token) =>
        !SEARCH_STOP_WORDS.has(token) &&
        (token.length >= 2 || allowSingleCharacterToken),
    )
    .slice(0, MAX_QUERY_TOKENS);

  if (tokens.length === 0) return [];

  const fuzzyBaseToken = [...tokens].sort((left, right) => right.length - left.length)[0];

  return tokens
    .map((token) => {
      const group = new Set<string>();
      const addTerm = (value: string) => {
        const normalized = normalizeProductSearchText(value);
        if (
          normalized.length >= 2 ||
          (allowSingleCharacterToken && normalized.length === 1)
        ) {
          group.add(normalized);
        }

        const compact = compactSearchText(value);
        if (compact.length >= 3) {
          group.add(compact);
        }
      };

      addTerm(token);

      const synonymTerms = [
        ...(synonymMap[token] ?? []),
        ...(synonymMap[normalizedQuery] ?? []),
      ];
      for (const synonym of synonymTerms) {
        addTerm(synonym);
      }

      for (const variant of buildDimensionVariants(token)) {
        addTerm(variant);
      }

      if (token === fuzzyBaseToken) {
        for (const fuzzyVariant of toDeleteDistanceOne(token).slice(0, MAX_FUZZY_TERMS)) {
          addTerm(fuzzyVariant);
        }
      }

      return Array.from(group).slice(0, MAX_GROUP_TERMS);
    })
    .filter((group) => group.length > 0);
};

export const matchesProductSearch = (
  document: ProductSearchDocument,
  query: string,
  options?: { synonyms?: ProductSearchSynonymMap },
) => {
  const normalizedQuery = normalizeProductSearchText(query);
  if (!normalizedQuery) return true;

  const groups = buildProductSearchTermGroups(query, options);
  if (groups.length === 0) return true;

  const searchIndex = buildSearchIndex(document);
  if (matchesPreparedField(searchIndex.all, normalizedQuery)) {
    return true;
  }

  return groups.every((group) =>
    group.some((term) => matchesPreparedField(searchIndex.all, term)),
  );
};

export const getProductSearchScore = (
  document: ProductSearchDocument,
  query: string,
  options?: { synonyms?: ProductSearchSynonymMap },
) => {
  const normalizedQuery = normalizeProductSearchText(query);
  if (!normalizedQuery) return 0;

  const searchIndex = buildSearchIndex(document);
  const groups = buildProductSearchTermGroups(query, options);
  const allGroupsMatched =
    groups.length > 0 &&
    groups.every((group) =>
      group.some((term) => matchesPreparedField(searchIndex.all, term)),
    );

  if (!matchesPreparedField(searchIndex.all, normalizedQuery) && !allGroupsMatched) {
    return 0;
  }

  let score = 0;

  score += getPhraseFieldScore(searchIndex.title, query, 220, 160, 110);
  score += getPhraseFieldScore(searchIndex.handle, query, 210, 150, 105);
  score += getPhraseFieldScore(searchIndex.variantSkus, query, 190, 135, 96);
  score += getPhraseFieldScore(searchIndex.variantTitles, query, 170, 125, 90);
  score += getPhraseFieldScore(searchIndex.manufacturer, query, 140, 95, 70);
  score += getPhraseFieldScore(searchIndex.categories, query, 120, 82, 60);
  score += getPhraseFieldScore(searchIndex.collections, query, 110, 78, 58);
  score += getPhraseFieldScore(searchIndex.tags, query, 100, 72, 54);
  score += getPhraseFieldScore(searchIndex.shortDescription, query, 82, 58, 42);
  score += getPhraseFieldScore(searchIndex.description, query, 60, 42, 32);
  score += getPhraseFieldScore(searchIndex.technicalDetails, query, 54, 36, 28);
  score += getPhraseFieldScore(searchIndex.extra, query, 72, 50, 36);

  for (const group of groups) {
    score += getGroupFieldScore(searchIndex.title, group, 28);
    score += getGroupFieldScore(searchIndex.handle, group, 24);
    score += getGroupFieldScore(searchIndex.variantSkus, group, 22);
    score += getGroupFieldScore(searchIndex.variantTitles, group, 20);
    score += getGroupFieldScore(searchIndex.manufacturer, group, 14);
    score += getGroupFieldScore(searchIndex.categories, group, 12);
    score += getGroupFieldScore(searchIndex.collections, group, 10);
    score += getGroupFieldScore(searchIndex.tags, group, 10);
    score += getGroupFieldScore(searchIndex.shortDescription, group, 8);
    score += getGroupFieldScore(searchIndex.description, group, 6);
    score += getGroupFieldScore(searchIndex.technicalDetails, group, 6);
    score += getGroupFieldScore(searchIndex.extra, group, 8);
  }

  if (allGroupsMatched) {
    score += 24;
  }

  return score;
};

export type { ProductSearchDocument };
