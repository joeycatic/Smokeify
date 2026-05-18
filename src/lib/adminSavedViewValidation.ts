export function normalizeAdminSavedViewRoute(value: unknown) {
  const route = typeof value === "string" ? value.trim() : "";
  if (!route.startsWith("/admin")) return null;
  return route.split("?")[0] || "/admin";
}

export function normalizeAdminSavedViewFilters(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .map(([key, rawValue]) => [key, Array.isArray(rawValue) ? rawValue[0] : rawValue])
      .filter(
        (entry): entry is [string, string] =>
          typeof entry[0] === "string" &&
          entry[0].trim().length > 0 &&
          typeof entry[1] === "string" &&
          entry[1].trim().length > 0,
      )
      .map(([key, rawValue]) => [key.trim(), rawValue.trim()]),
  );
}
