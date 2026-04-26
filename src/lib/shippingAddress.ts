export const SHIPPING_ADDRESS_TYPES = ["STREET", "PACKSTATION"] as const;

export type ShippingAddressType = (typeof SHIPPING_ADDRESS_TYPES)[number];

export type ShippingAddressInput = {
  shippingAddressType?: string | null;
  street?: string | null;
  houseNumber?: string | null;
  postalCode?: string | null;
  city?: string | null;
  country?: string | null;
  packstationNumber?: string | null;
  postNumber?: string | null;
};

export type ShippingAddressRecord = {
  shippingAddressType: ShippingAddressType;
  street: string | null;
  houseNumber: string | null;
  postalCode: string | null;
  city: string | null;
  country: string | null;
  packstationNumber: string | null;
  postNumber: string | null;
};

const normalizeText = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

export const normalizeShippingAddressType = (
  value?: string | null,
): ShippingAddressType => (value === "PACKSTATION" ? "PACKSTATION" : "STREET");

export const normalizeShippingAddress = (
  input: ShippingAddressInput,
): ShippingAddressRecord => {
  const shippingAddressType = normalizeShippingAddressType(
    input.shippingAddressType,
  );
  const postalCode = normalizeText(input.postalCode);
  const city = normalizeText(input.city);
  const country = normalizeText(input.country);

  if (shippingAddressType === "PACKSTATION") {
    return {
      shippingAddressType,
      street: null,
      houseNumber: null,
      postalCode,
      city,
      country,
      packstationNumber: normalizeText(input.packstationNumber),
      postNumber: normalizeText(input.postNumber),
    };
  }

  return {
    shippingAddressType,
    street: normalizeText(input.street),
    houseNumber: normalizeText(input.houseNumber),
    postalCode,
    city,
    country,
    packstationNumber: null,
    postNumber: null,
  };
};

export const isGermanyCountry = (value?: string | null) => {
  const normalized = value?.trim().toUpperCase();
  return normalized === "DE" || normalized === "DEU" || normalized === "DEUTSCHLAND";
};

export const hasShippingAddressValue = (input: ShippingAddressInput) => {
  const normalized = normalizeShippingAddress(input);
  return Object.values(normalized).some(
    (value) => value !== "STREET" && value !== "PACKSTATION" && Boolean(value),
  );
};

export const validateShippingAddress = (
  input: ShippingAddressInput,
  options?: { requireComplete?: boolean },
) => {
  const normalized = normalizeShippingAddress(input);
  const requireComplete = options?.requireComplete ?? false;
  const shouldValidate = requireComplete || hasShippingAddressValue(normalized);

  if (!shouldValidate) return null;

  if (normalized.shippingAddressType === "PACKSTATION") {
    if (!normalized.packstationNumber) {
      return "Packstation-Nummer ist erforderlich.";
    }
    if (!normalized.postNumber) {
      return "Postnummer ist erforderlich.";
    }
    if (!normalized.postalCode || !normalized.city || !normalized.country) {
      return "PLZ, Stadt und Land sind für die Packstation erforderlich.";
    }
    if (!isGermanyCountry(normalized.country)) {
      return "Packstation ist derzeit nur für Deutschland verfügbar.";
    }
    return null;
  }

  if (
    !normalized.street ||
    !normalized.houseNumber ||
    !normalized.postalCode ||
    !normalized.city ||
    !normalized.country
  ) {
    return "Straße, Hausnummer, PLZ, Stadt und Land sind erforderlich.";
  }

  return null;
};

export const buildShippingAddressLines = (input: ShippingAddressInput) => {
  const normalized = normalizeShippingAddress(input);

  if (normalized.shippingAddressType === "PACKSTATION") {
    return {
      line1: normalized.packstationNumber
        ? `Packstation ${normalized.packstationNumber}`
        : "",
      line2: normalized.postNumber ? `Postnummer ${normalized.postNumber}` : "",
    };
  }

  return {
    line1: [normalized.street, normalized.houseNumber].filter(Boolean).join(" ").trim(),
    line2: "",
  };
};
