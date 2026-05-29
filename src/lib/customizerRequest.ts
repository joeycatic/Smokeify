import { CUSTOMIZER_CATEGORY_HANDLES } from "@/lib/customizerCatalog";

export function parseCustomizerOptionCategories(value: string | null) {
  if (!value) return [...CUSTOMIZER_CATEGORY_HANDLES];
  const requested = value
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  const allowed = new Set<string>(CUSTOMIZER_CATEGORY_HANDLES);
  const safe = requested.filter((entry) => allowed.has(entry));
  return safe.length > 0 ? safe : [...CUSTOMIZER_CATEGORY_HANDLES];
}
