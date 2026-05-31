type ProductSeoInput = {
  title: string;
  seoTitle?: string | null;
  seoDescription?: string | null;
  shortDescription?: string | null;
  description?: string | null;
  manufacturer?: string | null;
  categories?: Array<{ title: string; parent?: { title: string } | null }>;
};

const stripHtml = (value: string) =>
  value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

const compact = (value: string, maxLength: number) => {
  if (value.length <= maxLength) return value;
  const clipped = value.slice(0, maxLength - 1).trimEnd();
  const lastSpace = clipped.lastIndexOf(" ");
  return `${clipped.slice(0, lastSpace > 80 ? lastSpace : clipped.length).trimEnd()}...`;
};

const includesWord = (value: string, word: string) =>
  value.toLowerCase().includes(word.trim().toLowerCase());

const getPrimaryCategoryTitle = (product: ProductSeoInput) => {
  const category = product.categories?.[0];
  if (!category) return null;
  return category.parent?.title ?? category.title;
};

export const buildProductSeoTitle = (product: ProductSeoInput) => {
  const explicit = product.seoTitle?.trim();
  if (explicit) return explicit;

  const titleParts = [product.title.trim()];
  const manufacturer = product.manufacturer?.trim();
  if (manufacturer && !includesWord(product.title, manufacturer)) {
    titleParts.unshift(manufacturer);
  }

  return compact(`${titleParts.join(" ")} kaufen | Smokeify`, 70);
};

export const buildProductSeoDescription = (product: ProductSeoInput) => {
  const explicit = product.seoDescription?.trim();
  if (explicit) return compact(explicit, 160);

  const shortDescription = product.shortDescription?.trim();
  if (shortDescription) return compact(shortDescription, 160);

  const plainDescription = stripHtml(product.description ?? "");
  if (plainDescription) return compact(plainDescription, 160);

  const categoryTitle = getPrimaryCategoryTitle(product);
  const context = categoryTitle ? ` aus ${categoryTitle}` : "";
  return compact(
    `${product.title} bei Smokeify kaufen: geprüftes Equipment${context}, sichere Zahlung und schnelle Lieferung innerhalb Deutschlands.`,
    160,
  );
};
