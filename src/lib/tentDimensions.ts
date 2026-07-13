export type TentCategoryInput = {
  handle?: string | null;
  parent?: { handle?: string | null } | null;
};

export type TentDimensions = {
  width: number;
  depth: number;
  height: number | null;
};

const normalize = (value?: string | null) =>
  (value ?? "")
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss");

export const parseTentDimensions = (value?: string | null): TentDimensions | null => {
  if (!value) return null;

  const match = normalize(value).match(/(\d{2,4})\s*x\s*(\d{2,4})(?:\s*x\s*(\d{2,4}))?/);
  if (!match) return null;

  return {
    width: Number(match[1]),
    depth: Number(match[2]),
    height: match[3] ? Number(match[3]) : null,
  };
};

export const isTentCategory = (categories?: TentCategoryInput[]) =>
  Boolean(
    categories?.some((category) => {
      const handle = normalize(category.handle);
      const parentHandle = normalize(category.parent?.handle);
      return (
        handle === "zelte" ||
        handle === "zelte-sets" ||
        parentHandle === "zelte" ||
        parentHandle === "zelte-sets"
      );
    }),
  );

export const formatTentDimensionLabel = (dimensions: TentDimensions) =>
  [dimensions.width, dimensions.depth, dimensions.height].filter(Boolean).join(" x ");

export const getTentFootprintSquareMeters = (dimensions: TentDimensions) =>
  (dimensions.width * dimensions.depth) / 10000;
