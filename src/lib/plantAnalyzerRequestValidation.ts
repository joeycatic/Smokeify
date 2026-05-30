export const PLANT_ANALYZER_MAX_IMAGE_BYTES = 7 * 1024 * 1024;
export const PLANT_ANALYZER_ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type PlantAnalyzerImageValidationResult =
  | { ok: true }
  | { ok: false; code: "UNSUPPORTED_IMAGE_TYPE" | "IMAGE_TOO_LARGE" };

export function validatePlantAnalyzerImageMeta(input: {
  mimeType: string;
  sizeBytes: number;
}): PlantAnalyzerImageValidationResult {
  if (
    !(PLANT_ANALYZER_ALLOWED_IMAGE_TYPES as readonly string[]).includes(
      input.mimeType,
    )
  ) {
    return { ok: false, code: "UNSUPPORTED_IMAGE_TYPE" };
  }
  if (input.sizeBytes > PLANT_ANALYZER_MAX_IMAGE_BYTES) {
    return { ok: false, code: "IMAGE_TOO_LARGE" };
  }
  return { ok: true };
}
