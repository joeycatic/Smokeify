import { getNavbarCategories } from "@/lib/navbarCategories";
import CommerceProvidersShell from "@/components/CommerceProvidersShell";

export default async function CommerceShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const initialNavbarCategories = await getNavbarCategories();

  return (
    <CommerceProvidersShell initialNavbarCategories={initialNavbarCategories}>
      {children}
    </CommerceProvidersShell>
  );
}

