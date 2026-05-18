import { notFound } from "next/navigation";
import { requireAdminScope } from "@/lib/adminCatalog";
import { listUnresolvedOrderAttributionRows } from "@/lib/adminAttribution";
import { getNewsletterAttributionDiagnostics } from "@/lib/adminNewsletter";
import AdminAttributionClient from "./AdminAttributionClient";

export default async function AdminAttributionPage() {
  if (!(await requireAdminScope("ops.read"))) notFound();

  const [attributionSnapshot, newsletterDiagnostics] = await Promise.all([
    listUnresolvedOrderAttributionRows(),
    getNewsletterAttributionDiagnostics(),
  ]);

  return (
    <div className="mx-auto w-full max-w-[1680px] px-3 py-3 text-stone-800 lg:px-5 xl:px-8">
      <AdminAttributionClient
        initialRows={attributionSnapshot.rows}
        initialEvidenceCounts={attributionSnapshot.evidenceCounts}
        newsletterDiagnostics={newsletterDiagnostics}
      />
    </div>
  );
}
