import type { AdminScriptDefinition } from "@/lib/adminScripts";

export function normalizeAdminScriptInputs(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {} as Record<string, string>;
  }

  return Object.fromEntries(
    Object.entries(value).flatMap(([key, rawValue]) =>
      typeof rawValue === "string" ? [[key, rawValue]] : [],
    ),
  );
}

function normalizeHttpUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

export function buildAdminScriptExecution(
  definition: AdminScriptDefinition,
  rawInputs: Record<string, string>,
) {
  switch (definition.id) {
    case "bloomtech:scrape-preview":
    case "bloomtech:scrape-category-preview":
    case "bloomtech:scrape-product-preview": {
      const rawSourceUrl = rawInputs.sourceUrl?.trim() ?? "";
      if (!rawSourceUrl) {
        return {
          scriptArgs: [] as string[],
          normalizedInputs: {} as Record<string, string>,
        };
      }

      const sourceUrl = normalizeHttpUrl(rawSourceUrl);
      if (!sourceUrl) {
        return {
          error: "Bloomtech link must be a valid http or https URL.",
        };
      }

      const hostname = new URL(sourceUrl).hostname.toLowerCase();
      if (hostname !== "bloomtech.de" && hostname !== "www.bloomtech.de") {
        return {
          error: "Bloomtech link must point to bloomtech.de.",
        };
      }

      return {
        scriptArgs: ["--url", sourceUrl],
        normalizedInputs: { sourceUrl },
      };
    }
    case "bloomtech:import-preview":
      return {
        scriptArgs: ["--apply"],
        envOverrides: {
          BLOOMTECH_IMPORT_ALLOW_WRITE: "1",
        } as Record<string, string>,
        normalizedInputs: {} as Record<string, string>,
      };
    case "pricing:seed-bloomtech-profiles":
      return {
        scriptArgs: ["--apply"],
        envOverrides: {
          PRICING_PROFILE_SEED_ALLOW_WRITE: "1",
        } as Record<string, string>,
        normalizedInputs: {} as Record<string, string>,
      };
    case "orders:backfill-attribution":
      return {
        scriptArgs: ["--apply"],
        envOverrides: {} as Record<string, string>,
        normalizedInputs: {} as Record<string, string>,
      };
    default:
      return {
        scriptArgs: [] as string[],
        envOverrides: {} as Record<string, string>,
        normalizedInputs: {} as Record<string, string>,
      };
  }
}
