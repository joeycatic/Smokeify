const IMAGE_SIGNATURES = {
  jpeg: { mime: "image/jpeg", extension: ".jpg" },
  png: { mime: "image/png", extension: ".png" },
  webp: { mime: "image/webp", extension: ".webp" },
  gif: { mime: "image/gif", extension: ".gif" },
  avif: { mime: "image/avif", extension: ".avif" },
} as const;

export type DetectedImage =
  | { format: "jpeg"; mime: "image/jpeg"; extension: ".jpg" }
  | { format: "png"; mime: "image/png"; extension: ".png" }
  | { format: "webp"; mime: "image/webp"; extension: ".webp" }
  | { format: "gif"; mime: "image/gif"; extension: ".gif" }
  | { format: "avif"; mime: "image/avif"; extension: ".avif" };

const hasBytes = (buffer: Buffer, offset: number, bytes: number[]) =>
  bytes.every((value, index) => buffer[offset + index] === value);

export const detectImageFromBuffer = (
  input: Buffer | Uint8Array
): DetectedImage | null => {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input);
  if (buffer.length < 12) return null;

  if (hasBytes(buffer, 0, [0xff, 0xd8, 0xff])) {
    return { format: "jpeg", ...IMAGE_SIGNATURES.jpeg };
  }

  if (
    hasBytes(buffer, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  ) {
    return { format: "png", ...IMAGE_SIGNATURES.png };
  }

  if (
    hasBytes(buffer, 0, [0x47, 0x49, 0x46, 0x38]) &&
    (hasBytes(buffer, 4, [0x37, 0x61]) || hasBytes(buffer, 4, [0x39, 0x61]))
  ) {
    return { format: "gif", ...IMAGE_SIGNATURES.gif };
  }

  if (
    hasBytes(buffer, 0, [0x52, 0x49, 0x46, 0x46]) &&
    hasBytes(buffer, 8, [0x57, 0x45, 0x42, 0x50])
  ) {
    return { format: "webp", ...IMAGE_SIGNATURES.webp };
  }

  const fileTypeBox = buffer.subarray(4, 12).toString("ascii");
  if (fileTypeBox === "ftypavif" || fileTypeBox === "ftypavis") {
    return { format: "avif", ...IMAGE_SIGNATURES.avif };
  }

  return null;
};

