const trimOptional = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const websiteUrl =
  trimOptional(process.env.NEXT_PUBLIC_APP_URL) ?? "https://www.smokeify.de";

export const businessDetails = {
  companyName: "Smokeify",
  legalName: "Joey Bennett Catic",
  streetLine: "Brinkeweg 106a",
  cityPostalLine: "33758 Schloß Holte-Stukenbrock",
  country: "Deutschland",
  contactEmail:
    trimOptional(process.env.NEXT_PUBLIC_CONTACT_EMAIL) ??
    trimOptional(process.env.CONTACT_EMAIL) ??
    "contact@smokeify.de",
  contactPhone: trimOptional(process.env.NEXT_PUBLIC_CONTACT_PHONE),
  websiteUrl,
  websiteLabel: websiteUrl.replace(/^https?:\/\//, "").replace(/\/$/, ""),
  vatId:
    trimOptional(process.env.UST_ID) ??
    trimOptional(process.env.NEXT_PUBLIC_UST_ID),
} as const;

const isPresent = (value: string | null): value is string => Boolean(value);

export const documentSellerLines = [
  businessDetails.companyName,
  businessDetails.streetLine,
  businessDetails.cityPostalLine,
  businessDetails.country,
  businessDetails.contactEmail,
  businessDetails.vatId ? `USt-IdNr.: ${businessDetails.vatId}` : null,
].filter(isPresent);

export const supportCompanyLines = [
  businessDetails.companyName,
  businessDetails.legalName,
  businessDetails.streetLine,
  businessDetails.cityPostalLine,
  businessDetails.country,
  `Telefon: ${businessDetails.contactPhone ?? "-"}`,
  `E-Mail: ${businessDetails.contactEmail}`,
  businessDetails.vatId ? `USt-IdNr.: ${businessDetails.vatId}` : null,
].filter(isPresent);
