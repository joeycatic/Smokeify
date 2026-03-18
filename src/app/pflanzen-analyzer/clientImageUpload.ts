const MAX_DIMENSION = 1600;
const TARGET_MAX_BYTES = 2 * 1024 * 1024;

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to load image"));
    image.src = src;
  });

const canvasToBlob = (
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number,
) =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Failed to encode image"));
        return;
      }
      resolve(blob);
    }, type, quality);
  });

export async function prepareAnalyzerImageFile(file: File) {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please upload an image.");
  }

  const sourceUrl = URL.createObjectURL(file);

  try {
    const image = await loadImage(sourceUrl);
    const maxSourceDimension = Math.max(image.naturalWidth, image.naturalHeight);
    const scale =
      maxSourceDimension > MAX_DIMENSION
        ? MAX_DIMENSION / maxSourceDimension
        : 1;
    const targetWidth = Math.max(1, Math.round(image.naturalWidth * scale));
    const targetHeight = Math.max(1, Math.round(image.naturalHeight * scale));

    if (
      scale === 1 &&
      file.size <= TARGET_MAX_BYTES &&
      (file.type === "image/jpeg" ||
        file.type === "image/png" ||
        file.type === "image/webp")
    ) {
      return file;
    }

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Canvas is not available");
    }

    context.drawImage(image, 0, 0, targetWidth, targetHeight);

    const preferredType =
      file.type === "image/png" && file.size <= TARGET_MAX_BYTES
        ? "image/png"
        : "image/jpeg";
    let blob = await canvasToBlob(
      canvas,
      preferredType,
      preferredType === "image/jpeg" ? 0.82 : undefined,
    );

    if (blob.size > TARGET_MAX_BYTES) {
      blob = await canvasToBlob(canvas, "image/jpeg", 0.72);
    }

    const baseName = file.name.replace(/\.[^.]+$/, "") || "plant-photo";
    const extension = blob.type === "image/png" ? ".png" : ".jpg";

    return new File([blob], `${baseName}${extension}`, {
      type: blob.type,
      lastModified: Date.now(),
    });
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}
