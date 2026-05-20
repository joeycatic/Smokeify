import PasswordResetClient from "./PasswordResetClient";
import { parseStorefront } from "@/lib/storefronts";
import { getPreferredUserAuthOrigin } from "@/lib/userStorefront";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function normalizeParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
}

export default async function PasswordResetPage({ searchParams }: PageProps) {
  const resolvedSearchParams = await searchParams;
  const initialEmail = normalizeParam(resolvedSearchParams?.email).trim();
  const initialCode = normalizeParam(resolvedSearchParams?.code)
    .replace(/\D/g, "")
    .slice(0, 6);
  const initialStorefront = parseStorefront(
    normalizeParam(resolvedSearchParams?.storefront)
  );
  const preferredSignInOrigin = initialStorefront
    ? getPreferredUserAuthOrigin(initialStorefront)
    : null;

  return (
    <PasswordResetClient
      initialEmail={initialEmail}
      initialCode={initialCode}
      preferredSignInOrigin={preferredSignInOrigin}
      storefrontVariant={initialStorefront ?? "MAIN"}
    />
  );
}
