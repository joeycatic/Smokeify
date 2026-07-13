const DEFAULT_SITE_NAME = "Smokeify";
const DEFAULT_SITE_URL = "https://www.smokeify.de";
const DEFAULT_CONTACT_EMAIL = "contact@smokeify.de";

const normalizeUrl = (value: string | undefined, fallback: string) => {
  const trimmed = value?.trim();
  if (!trimmed) return fallback;

  try {
    return new URL(trimmed).toString().replace(/\/+$/, "");
  } catch {
    return fallback;
  }
};

export const SITE_NAME =
  process.env.NEXT_PUBLIC_SITE_NAME?.trim() || DEFAULT_SITE_NAME;

export const SITE_URL = normalizeUrl(
  process.env.NEXT_PUBLIC_APP_URL,
  DEFAULT_SITE_URL,
);

export const DEFAULT_DESCRIPTION =
  "Smokeify verbindet Grow- und Headshop-Equipment mit klarer Produktauswahl, transparentem Versand und sicherem Checkout aus Deutschland.";

export const SITE_TAGLINE =
  process.env.NEXT_PUBLIC_SITE_TAGLINE?.trim() || "Equipment ohne Rätselraten";

export const CONTACT_EMAIL =
  process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() ||
  process.env.CONTACT_EMAIL?.trim() ||
  DEFAULT_CONTACT_EMAIL;

export const buildAbsoluteUrl = (path: string) => {
  const trimmed = path.trim();
  if (!trimmed) return SITE_URL;

  try {
    return new URL(trimmed, `${SITE_URL}/`).toString();
  } catch {
    return `${SITE_URL}${trimmed.startsWith("/") ? trimmed : `/${trimmed}`}`;
  }
};
