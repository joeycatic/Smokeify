const NEXT_IMAGE_OPTIMIZER_UNSAFE_HOSTS = new Set([
  "pdgpa612bwysfijp.public.blob.vercel-storage.com",
  "public.blob.vercel-storage.com",
]);

export const shouldBypassImageOptimization = (src?: string | null) => {
  if (!src) return false;
  if (src.startsWith("/")) return false;

  try {
    const url = new URL(src);
    return NEXT_IMAGE_OPTIMIZER_UNSAFE_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
};

export const getImageFallbackLabel = (alt: string) =>
  alt
    .split(/\s+/)
    .map((part) => part.trim()[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "SM";
